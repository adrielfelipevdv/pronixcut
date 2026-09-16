import type { Canvas2DEffectContext } from "@/effects/types";
import {
	applyIntensity,
	readColorGradeValues,
	type ColorGradeValues,
} from "./params";
import {
	applyAdvancedGpuPass,
	isAdvancedGradeNeutral,
	readAdvancedGradeInputs,
} from "./webgl/grade-pass";

// Real, native-canvas image processing — no per-pixel JS loops (keeps this
// safe to run every playback frame). `filter` contributes to ONE combined
// ctx.filter string (a single native filtered draw); `overlay` composites a
// handful of blend-mode passes on top (gradients / a cached noise texture),
// which is still just regular canvas drawing, not manual pixel manipulation.
//
// Known simplification vs. a full grading engine: "Vibrância" here is a
// weaker saturation boost (real, but not the selective low-saturation-only
// algorithm real vibrance uses), and "Realces/Sombras/Brancos/Pretos" are
// approximated via blend-mode overlays rather than true per-channel
// lift/gamma/gain — both are genuine pixel-affecting adjustments, just not
// the same math a color-science-grade tool would use.

export function buildColorGradeFilter({
	effectParams,
}: {
	effectParams: Record<string, unknown>;
}): string | null {
	const values = applyIntensity(readColorGradeValues(effectParams));
	const parts: string[] = [];

	if (values.exposure !== 0) {
		parts.push(`brightness(${(2 ** (values.exposure / 100)).toFixed(3)})`);
	}
	if (values.brightness !== 0) {
		parts.push(`brightness(${Math.max(0, 1 + values.brightness / 100).toFixed(3)})`);
	}
	if (values.contrast !== 0) {
		parts.push(`contrast(${Math.max(0, 1 + values.contrast / 100).toFixed(3)})`);
	}
	if (values.saturation !== 0) {
		parts.push(`saturate(${Math.max(0, 1 + values.saturation / 100).toFixed(3)})`);
	}
	if (values.vibrance !== 0) {
		parts.push(`saturate(${Math.max(0, 1 + (values.vibrance / 100) * 0.5).toFixed(3)})`);
	}
	if (values.hue !== 0) {
		parts.push(`hue-rotate(${values.hue.toFixed(1)}deg)`);
	}

	return parts.length > 0 ? parts.join(" ") : null;
}

function drawToneOverlay({
	ctx,
	width,
	height,
	amount,
	maxOpacity = 0.35,
}: {
	ctx: Canvas2DEffectContext;
	width: number;
	height: number;
	amount: number;
	maxOpacity?: number;
}): void {
	if (amount === 0) return;
	const opacity = Math.min(1, Math.abs(amount) / 100) * maxOpacity;
	ctx.save();
	ctx.globalAlpha = opacity;
	ctx.globalCompositeOperation = amount > 0 ? "screen" : "multiply";
	ctx.fillStyle = amount > 0 ? "#ffffff" : "#000000";
	ctx.fillRect(0, 0, width, height);
	ctx.restore();
}

function drawTemperatureOverlay({
	ctx,
	width,
	height,
	temperature,
}: {
	ctx: Canvas2DEffectContext;
	width: number;
	height: number;
	temperature: number;
}): void {
	if (temperature === 0) return;
	const opacity = Math.min(1, Math.abs(temperature) / 100) * 0.5;
	ctx.save();
	ctx.globalAlpha = opacity;
	ctx.globalCompositeOperation = "soft-light";
	ctx.fillStyle = temperature > 0 ? "rgb(255,150,50)" : "rgb(50,130,255)";
	ctx.fillRect(0, 0, width, height);
	ctx.restore();
}

function drawFadeOverlay({
	ctx,
	width,
	height,
	fade,
}: {
	ctx: Canvas2DEffectContext;
	width: number;
	height: number;
	fade: number;
}): void {
	if (fade <= 0) return;
	ctx.save();
	ctx.globalAlpha = Math.min(1, fade / 100) * 0.35;
	ctx.globalCompositeOperation = "lighten";
	ctx.fillStyle = "rgb(200,200,195)";
	ctx.fillRect(0, 0, width, height);
	ctx.restore();
}

function drawVignetteOverlay({
	ctx,
	width,
	height,
	vignette,
	vignetteSize,
	vignetteFeather,
}: {
	ctx: Canvas2DEffectContext;
	width: number;
	height: number;
	vignette: number;
	vignetteSize: number;
	vignetteFeather: number;
}): void {
	if (vignette <= 0) return;
	const strength = Math.min(1, vignette / 100);
	const size = Math.min(1, Math.max(0, vignetteSize / 100));
	const feather = Math.min(1, Math.max(0, vignetteFeather / 100));
	const cx = width / 2;
	const cy = height / 2;
	// `size` pushes the clear center outward, `feather` widens the gradient
	// band between the clear center and the fully-darkened edge.
	const innerRadius = Math.min(width, height) * (0.15 + size * 0.55);
	const outerRadius = innerRadius + Math.max(width, height) * (0.15 + feather * 0.6);
	const gradient = ctx.createRadialGradient(cx, cy, Math.max(0, innerRadius), cx, cy, outerRadius);
	gradient.addColorStop(0, "rgba(0,0,0,0)");
	gradient.addColorStop(1, `rgba(0,0,0,${(0.15 + strength * 0.6).toFixed(3)})`);
	ctx.save();
	ctx.globalCompositeOperation = "multiply";
	ctx.fillStyle = gradient;
	ctx.fillRect(0, 0, width, height);
	ctx.restore();
}

// Grain needs actual noise, but generating it is a one-time cost per
// (pixelSize, softness) bucket — the pattern is built once and reused as a
// tiled fill on every draw afterwards, so applying it costs one canvas
// fillRect (+ a native blur for "softness"), not a per-pixel loop.
const grainPatternCache = new Map<string, OffscreenCanvas>();

function getGrainTile({ size, softness }: { size: number; softness: number }): OffscreenCanvas {
	// Bucket to whole pixels / 5%-steps so a dragged slider doesn't regenerate
	// noise on every intermediate value.
	const pixelSize = Math.round(size);
	const softBucket = Math.round(softness * 20) / 20;
	const key = `${pixelSize}:${softBucket}`;
	const cached = grainPatternCache.get(key);
	if (cached) return cached;

	const tileSize = 128;
	const raw = new OffscreenCanvas(tileSize, tileSize);
	const rawCtx = raw.getContext("2d");
	if (rawCtx) {
		const imageData = rawCtx.createImageData(tileSize, tileSize);
		for (let i = 0; i < imageData.data.length; i += 4) {
			const value = Math.floor(Math.random() * 255);
			imageData.data[i] = value;
			imageData.data[i + 1] = value;
			imageData.data[i + 2] = value;
			imageData.data[i + 3] = 255;
		}
		rawCtx.putImageData(imageData, 0, 0);
	}

	// pixelSize scales the grain's apparent size (nearest-neighbor upscale of
	// a smaller noise field keeps blocky "large grain" chunky rather than
	// just blurring it), softness then blurs that result.
	const grainPx = Math.max(1, Math.round(pixelSize / 24));
	const smallSize = Math.max(4, Math.round(tileSize / grainPx));
	const upscaled = new OffscreenCanvas(tileSize, tileSize);
	const upscaledCtx = upscaled.getContext("2d");
	if (upscaledCtx) {
		upscaledCtx.imageSmoothingEnabled = false;
		upscaledCtx.drawImage(raw, 0, 0, smallSize, smallSize, 0, 0, tileSize, tileSize);
	}

	const tile = new OffscreenCanvas(tileSize, tileSize);
	const tileCtx = tile.getContext("2d");
	if (tileCtx) {
		tileCtx.filter = softBucket > 0 ? `blur(${(softBucket * 2).toFixed(2)}px)` : "none";
		tileCtx.drawImage(upscaled, 0, 0);
	}
	grainPatternCache.set(key, tile);
	return tile;
}

function drawGrainOverlay({
	ctx,
	width,
	height,
	grain,
	grainSize,
	grainSoftness,
}: {
	ctx: Canvas2DEffectContext;
	width: number;
	height: number;
	grain: number;
	grainSize: number;
	grainSoftness: number;
}): void {
	if (grain <= 0) return;
	const tile = getGrainTile({ size: grainSize, softness: Math.min(1, Math.max(0, grainSoftness / 100)) });
	const pattern = ctx.createPattern(tile, "repeat");
	if (!pattern) return;
	ctx.save();
	ctx.globalAlpha = Math.min(1, grain / 100) * 0.4;
	ctx.globalCompositeOperation = "overlay";
	ctx.fillStyle = pattern;
	ctx.fillRect(0, 0, width, height);
	ctx.restore();
}

export function drawColorGradeOverlay({
	ctx,
	width,
	height,
	effectParams,
}: {
	ctx: Canvas2DEffectContext;
	width: number;
	height: number;
	effectParams: Record<string, unknown>;
}): void {
	const v: ColorGradeValues = applyIntensity(readColorGradeValues(effectParams));

	// Order documented in adjustments/README.md: básico/avançado tonal
	// (native canvas composite ops, below) -> GPU pass (detail/HSL
	// seletivo/curvas/LUT — genuinely needs per-pixel or neighborhood math)
	// -> vignette/grain finishing touches, last.
	drawToneOverlay({ ctx, width, height, amount: v.shadows });
	drawToneOverlay({ ctx, width, height, amount: v.highlights });
	drawToneOverlay({ ctx, width, height, amount: v.blacks, maxOpacity: 0.45 });
	drawToneOverlay({ ctx, width, height, amount: v.whites, maxOpacity: 0.45 });
	drawTemperatureOverlay({ ctx, width, height, temperature: v.temperature });
	drawFadeOverlay({ ctx, width, height, fade: v.fade });

	const advancedInputs = readAdvancedGradeInputs(effectParams, {
		sharpness: v.sharpness,
		clarity: v.clarity,
		noiseReduction: v.noiseReduction,
		lutIntensity: v.lutIntensity,
	});
	if (!isAdvancedGradeNeutral(advancedInputs)) {
		applyAdvancedGpuPass({ ctx, width, height, inputs: advancedInputs });
	}

	drawVignetteOverlay({
		ctx,
		width,
		height,
		vignette: v.vignette,
		vignetteSize: v.vignetteSize,
		vignetteFeather: v.vignetteFeather,
	});
	drawGrainOverlay({
		ctx,
		width,
		height,
		grain: v.grain,
		grainSize: v.grainSize,
		grainSoftness: v.grainSoftness,
	});
}
