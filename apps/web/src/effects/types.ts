import type { ParamDefinition, ParamValues } from "@/params";

export interface Effect {
	id: string;
	type: string;
	params: ParamValues;
	enabled: boolean;
}

export type EffectUniformValue = number | number[];

export interface EffectPass {
	shader: string;
	uniforms: Record<string, EffectUniformValue>;
}

export interface EffectPassTemplate {
	shader: string;
	uniforms(params: {
		effectParams: ParamValues;
		width: number;
		height: number;
	}): Record<string, EffectUniformValue>;
}

/**
 * WGPU/WASM shader-based renderer — the original effect mechanism (e.g.
 * blur). Passes are compiled shaders inside the Rust compositor; adding a
 * new one requires a Rust build (cargo + wasm-pack), which isn't available
 * in every environment this app is developed in.
 */
export interface GpuEffectRendererConfig {
	kind: "gpu";
	passes: EffectPassTemplate[];
	buildPasses?: (params: {
		effectParams: ParamValues;
		width: number;
		height: number;
	}) => EffectPass[];
}

export type Canvas2DEffectContext =
	| CanvasRenderingContext2D
	| OffscreenCanvasRenderingContext2D;

/**
 * Native Canvas2D renderer — real pixel-level image processing (the
 * browser's own filter/compositing engine), used for effects that don't
 * need a custom GPU shader (color grading, vignette, grain, fade). Applied
 * directly on the element's source frame before it's handed to the
 * compositor, so it affects preview AND export identically, with no cost
 * for elements that don't have one of these effects attached.
 */
export interface Canvas2DEffectRendererConfig {
	kind: "canvas2d";
	/** Contributes to a single combined `ctx.filter` string applied once per element (cheap: one native filtered draw, no per-pixel JS). */
	filter?: (params: { effectParams: ParamValues }) => string | null;
	/** Extra compositing pass(es) drawn on top of the filtered image (vignette gradients, cached grain texture, tone overlays) — still no per-pixel JS loops. */
	overlay?: (params: {
		ctx: Canvas2DEffectContext;
		width: number;
		height: number;
		effectParams: ParamValues;
	}) => void;
}

export type EffectRendererConfig =
	| GpuEffectRendererConfig
	| Canvas2DEffectRendererConfig;

export interface EffectDefinition {
	type: string;
	name: string;
	keywords: string[];
	params: ParamDefinition[];
	renderer: EffectRendererConfig;
}
