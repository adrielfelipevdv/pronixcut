import type { Canvas2DEffectContext } from "@/effects/types";
import { composeChannelLut } from "../curve-math";
import { HSL_BAND_INFO, HSL_CHANNEL_KEYS, isHslNeutral, type HslValues } from "../hsl-bands";
import {
	isCurvesNeutral,
	readCurvesFromParams,
	readHslFromParams,
	readLutId,
	type CurvesValues,
} from "../advanced-types";
import { resolveLutGrid } from "../luts/lut-registry";
import { createIdentityLutGrid, type LutGrid } from "../luts/types";
import { GRADE_FRAGMENT_SHADER, GRADE_VERTEX_SHADER } from "./shaders";

// Single combined GPU pass for the operations that genuinely need per-pixel
// or neighborhood math (unlike ../render.ts's canvas2d filter/overlay,
// which stays native-composited). One shared WebGL2 context + compiled
// program, reused across draws — never recreated per frame. Runs entirely
// GPU-resident: the source is uploaded as a texture (no CPU pixel
// readback), the shader executes on the GPU, and the result is blitted
// back onto the destination 2D context with a single `drawImage`.

interface GlState {
	canvas: OffscreenCanvas;
	gl: WebGL2RenderingContext;
	program: WebGLProgram;
	uniforms: Record<string, WebGLUniformLocation | null>;
	sourceTexture: WebGLTexture;
	curveTexture: WebGLTexture;
	lut3dTexture: WebGLTexture;
	lastCurveKey: string | null;
	lastLutId: string | null;
	width: number;
	height: number;
}

let state: GlState | null = null;

function compileShader({
	gl,
	type,
	source,
}: {
	gl: WebGL2RenderingContext;
	type: number;
	source: string;
}): WebGLShader {
	const shader = gl.createShader(type);
	if (!shader) throw new Error("Failed to create WebGL shader");
	gl.shaderSource(shader, source);
	gl.compileShader(shader);
	if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
		const info = gl.getShaderInfoLog(shader);
		gl.deleteShader(shader);
		throw new Error(`WebGL shader compile error: ${info}`);
	}
	return shader;
}

const UNIFORM_NAMES = [
	"uSource",
	"uCurveLut",
	"uLut3D",
	"uTexelSize",
	"uSharpness",
	"uClarity",
	"uNoiseReduction",
	"uHueCenters",
	"uHslHueShift",
	"uHslSat",
	"uHslLight",
	"uHasHsl",
	"uHasCurves",
	"uHasLut",
	"uLutIntensity",
] as const;

function initGl(): GlState {
	const canvas = new OffscreenCanvas(2, 2);
	const gl = canvas.getContext("webgl2", { premultipliedAlpha: false });
	if (!gl) throw new Error("WebGL2 not available");

	const vertexShader = compileShader({ gl, type: gl.VERTEX_SHADER, source: GRADE_VERTEX_SHADER });
	const fragmentShader = compileShader({
		gl,
		type: gl.FRAGMENT_SHADER,
		source: GRADE_FRAGMENT_SHADER,
	});
	const program = gl.createProgram();
	if (!program) throw new Error("Failed to create WebGL program");
	gl.attachShader(program, vertexShader);
	gl.attachShader(program, fragmentShader);
	gl.linkProgram(program);
	if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
		const info = gl.getProgramInfoLog(program);
		throw new Error(`WebGL program link error: ${info}`);
	}

	const uniforms: Record<string, WebGLUniformLocation | null> = {};
	for (const name of UNIFORM_NAMES) {
		uniforms[name] = gl.getUniformLocation(program, name);
	}

	const sourceTexture = createTexture(gl);
	const curveTexture = createTexture(gl);
	const lut3dTexture = gl.createTexture();
	if (!lut3dTexture) throw new Error("Failed to create LUT 3D texture");
	gl.bindTexture(gl.TEXTURE_3D, lut3dTexture);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_3D, gl.TEXTURE_WRAP_R, gl.CLAMP_TO_EDGE);
	uploadLut3D(gl, lut3dTexture, createIdentityLutGrid({ size: 2 }));

	return {
		canvas,
		gl,
		program,
		uniforms,
		sourceTexture,
		curveTexture,
		lut3dTexture,
		lastCurveKey: null,
		lastLutId: null,
		width: 2,
		height: 2,
	};
}

function createTexture(gl: WebGL2RenderingContext): WebGLTexture {
	const texture = gl.createTexture();
	if (!texture) throw new Error("Failed to create WebGL texture");
	gl.bindTexture(gl.TEXTURE_2D, texture);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
	gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
	return texture;
}

function uploadLut3D(gl: WebGL2RenderingContext, texture: WebGLTexture, grid: LutGrid): void {
	// RGBA8 (not float) so TEXTURE_MIN/MAG_FILTER = LINEAR (trilinear
	// sampling between grid cells) works in core WebGL2 with no extension —
	// float texture formats need OES_texture_float_linear for that, which
	// isn't guaranteed available. 8 bits/channel is standard precision for a
	// color LUT and is visually indistinguishable here.
	const { size, data } = grid;
	const rgba = new Uint8Array(size * size * size * 4);
	for (let i = 0; i < size * size * size; i++) {
		rgba[i * 4] = Math.round(Math.min(1, Math.max(0, data[i * 3])) * 255);
		rgba[i * 4 + 1] = Math.round(Math.min(1, Math.max(0, data[i * 3 + 1])) * 255);
		rgba[i * 4 + 2] = Math.round(Math.min(1, Math.max(0, data[i * 3 + 2])) * 255);
		rgba[i * 4 + 3] = 255;
	}
	gl.bindTexture(gl.TEXTURE_3D, texture);
	gl.texImage3D(
		gl.TEXTURE_3D,
		0,
		gl.RGBA8,
		size,
		size,
		size,
		0,
		gl.RGBA,
		gl.UNSIGNED_BYTE,
		rgba,
	);
}

function buildCurveTextureData({ curves }: { curves: CurvesValues }): Uint8Array {
	const redLut = composeChannelLut({ rgbPoints: curves.rgb, channelPoints: curves.red });
	const greenLut = composeChannelLut({ rgbPoints: curves.rgb, channelPoints: curves.green });
	const blueLut = composeChannelLut({ rgbPoints: curves.rgb, channelPoints: curves.blue });
	const out = new Uint8Array(256 * 4);
	for (let i = 0; i < 256; i++) {
		out[i * 4] = redLut[i];
		out[i * 4 + 1] = greenLut[i];
		out[i * 4 + 2] = blueLut[i];
		out[i * 4 + 3] = 255;
	}
	return out;
}

function hasNonIdentityCurves(curves: CurvesValues): boolean {
	return !isCurvesNeutral(curves);
}

export interface AdvancedGradeInputs {
	sharpness: number; // 0..100
	clarity: number; // -100..100
	noiseReduction: number; // 0..100
	hsl: HslValues;
	curves: CurvesValues;
	lutId: string | null;
	lutIntensity: number; // 0..100
}

export function readAdvancedGradeInputs(
	effectParams: Record<string, unknown>,
	numeric: { sharpness: number; clarity: number; noiseReduction: number; lutIntensity: number },
): AdvancedGradeInputs {
	return {
		sharpness: numeric.sharpness,
		clarity: numeric.clarity,
		noiseReduction: numeric.noiseReduction,
		hsl: readHslFromParams(effectParams),
		curves: readCurvesFromParams(effectParams),
		lutId: readLutId(effectParams),
		lutIntensity: numeric.lutIntensity,
	};
}

export function isAdvancedGradeNeutral(inputs: AdvancedGradeInputs): boolean {
	return (
		inputs.sharpness === 0 &&
		inputs.clarity === 0 &&
		inputs.noiseReduction === 0 &&
		isHslNeutral(inputs.hsl) &&
		!hasNonIdentityCurves(inputs.curves) &&
		!inputs.lutId
	);
}

/**
 * Draws the GPU-graded result of `ctx`'s current pixels back onto `ctx`.
 * No-op (returns false) if every advanced field is neutral, so clips that
 * don't touch Avançado/HSL/Curvas/LUT never pay for this pass.
 */
export function applyAdvancedGpuPass({
	ctx,
	width,
	height,
	inputs,
}: {
	ctx: Canvas2DEffectContext;
	width: number;
	height: number;
	inputs: AdvancedGradeInputs;
}): boolean {
	if (isAdvancedGradeNeutral(inputs)) return false;
	if (width <= 0 || height <= 0) return false;

	if (!state) {
		try {
			state = initGl();
		} catch (error) {
			console.error("Advanced color grade: WebGL2 unavailable, skipping pass", error);
			return false;
		}
	}

	const { gl, program, uniforms } = state;

	if (state.width !== width || state.height !== height) {
		state.canvas.width = width;
		state.canvas.height = height;
		state.width = width;
		state.height = height;
	}
	gl.viewport(0, 0, width, height);
	gl.useProgram(program);

	// Source: upload the current 2D-canvas content as a texture (GPU blit,
	// no CPU readback). FLIP_Y so texture-space (0,0) matches canvas-space
	// top-left, consistent with the fullscreen-quad UV mapping below.
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, true);
	gl.activeTexture(gl.TEXTURE0);
	gl.bindTexture(gl.TEXTURE_2D, state.sourceTexture);
	gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE, ctx.canvas as TexImageSource);
	gl.pixelStorei(gl.UNPACK_FLIP_Y_WEBGL, false);
	gl.uniform1i(uniforms.uSource, 0);

	// Curves.
	const hasCurves = hasNonIdentityCurves(inputs.curves);
	const curveKey = hasCurves
		? `${JSON.stringify(inputs.curves.rgb)}|${JSON.stringify(inputs.curves.red)}|${JSON.stringify(inputs.curves.green)}|${JSON.stringify(inputs.curves.blue)}`
		: null;
	gl.activeTexture(gl.TEXTURE1);
	gl.bindTexture(gl.TEXTURE_2D, state.curveTexture);
	if (hasCurves && curveKey !== state.lastCurveKey) {
		const data = buildCurveTextureData({ curves: inputs.curves });
		gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, 256, 1, 0, gl.RGBA, gl.UNSIGNED_BYTE, data);
		state.lastCurveKey = curveKey;
	}
	gl.uniform1i(uniforms.uCurveLut, 1);
	gl.uniform1i(uniforms.uHasCurves, hasCurves ? 1 : 0);

	// 3D LUT.
	const hasLut = Boolean(inputs.lutId);
	gl.activeTexture(gl.TEXTURE2);
	gl.bindTexture(gl.TEXTURE_3D, state.lut3dTexture);
	if (hasLut && inputs.lutId !== state.lastLutId) {
		const grid = resolveLutGrid({ id: inputs.lutId });
		if (grid) {
			uploadLut3D(gl, state.lut3dTexture, grid);
			state.lastLutId = inputs.lutId;
		}
	}
	gl.uniform1i(uniforms.uLut3D, 2);
	gl.uniform1i(uniforms.uHasLut, hasLut ? 1 : 0);
	gl.uniform1f(uniforms.uLutIntensity, Math.min(1, Math.max(0, inputs.lutIntensity / 100)));

	// HSL selective.
	const hasHsl = !isHslNeutral(inputs.hsl);
	gl.uniform1i(uniforms.uHasHsl, hasHsl ? 1 : 0);
	const hueCenters = new Float32Array(8);
	const hueShift = new Float32Array(8);
	const satShift = new Float32Array(8);
	const lightShift = new Float32Array(8);
	HSL_CHANNEL_KEYS.forEach((key, i) => {
		hueCenters[i] = HSL_BAND_INFO[key].hueDeg;
		const band = inputs.hsl[key];
		hueShift[i] = (band.hue / 100) * 180;
		satShift[i] = band.saturation / 100;
		lightShift[i] = band.lightness / 100;
	});
	gl.uniform1fv(uniforms.uHueCenters, hueCenters);
	gl.uniform1fv(uniforms.uHslHueShift, hueShift);
	gl.uniform1fv(uniforms.uHslSat, satShift);
	gl.uniform1fv(uniforms.uHslLight, lightShift);

	// Detail (noise / sharpen / clarity).
	gl.uniform1f(uniforms.uNoiseReduction, Math.min(1, Math.max(0, inputs.noiseReduction / 100)));
	gl.uniform1f(uniforms.uSharpness, Math.min(1, Math.max(0, inputs.sharpness / 100)));
	gl.uniform1f(uniforms.uClarity, Math.min(1, Math.max(-1, inputs.clarity / 100)));
	gl.uniform2f(uniforms.uTexelSize, 1 / width, 1 / height);

	gl.disable(gl.DEPTH_TEST);
	gl.disable(gl.BLEND);
	gl.drawArrays(gl.TRIANGLES, 0, 3);

	ctx.save();
	ctx.globalCompositeOperation = "copy";
	ctx.drawImage(state.canvas, 0, 0, width, height);
	ctx.restore();

	return true;
}
