import {
	applyEffectPasses,
	applyMaskFeather as applyMaskFeatherWasm,
	initializeGpu,
	initializePreviewGpu,
} from "opencut-wasm";
import type { EffectPass, EffectUniformValue } from "@/effects/types";

let gpuAvailable = false;
let initPromise: Promise<void> | null = null;

export function initializeGpuRenderer(): Promise<void> {
	if (!initPromise) {
		initPromise = initializeGpu()
			.then(() => {
				gpuAvailable = true;
			})
			.catch((error: unknown) => {
				gpuAvailable = false;
				const message = error instanceof Error ? error.message : String(error);
				console.warn(`GPU renderer unavailable: ${message}`);
			});
	}
	return initPromise;
}

export function isGpuAvailable(): boolean {
	return gpuAvailable;
}

// A second, independent GPU context/device (see rust/wasm/src/gpu.rs's
// PREVIEW_GPU_RUNTIME) used only for one-off preview renders — effect/blur
// card thumbnails, mask feather previews. It must never share a device (and,
// on the WebGL fallback, a canvas) with the main compositor: that sharing was
// the actual cause of the Main Viewer briefly/persistently showing an effect
// card's stock demo photo — rendering a preview thumbnail was reusing and
// resizing the compositor's own mounted canvas as scratch space.
let previewGpuAvailable = false;
let previewInitPromise: Promise<void> | null = null;

export function initializePreviewGpuRenderer(): Promise<void> {
	if (!previewInitPromise) {
		previewInitPromise = initializePreviewGpu()
			.then(() => {
				previewGpuAvailable = true;
			})
			.catch((error: unknown) => {
				previewGpuAvailable = false;
				const message = error instanceof Error ? error.message : String(error);
				console.warn(`Preview GPU renderer unavailable: ${message}`);
			});
	}
	return previewInitPromise;
}

export function isPreviewGpuAvailable(): boolean {
	return previewGpuAvailable;
}

export const gpuRenderer = {
	applyEffect({
		source,
		width,
		height,
		passes,
	}: {
		source: OffscreenCanvas;
		width: number;
		height: number;
		passes: EffectPass[];
	}): OffscreenCanvas {
		if (passes.length === 0 || !previewGpuAvailable) {
			return source;
		}

		return applyEffectPasses({
			source,
			width,
			height,
			passes: serializeEffectPasses(passes),
		});
	},

	applyMaskFeather({
		maskCanvas,
		width,
		height,
		feather,
	}: {
		maskCanvas: OffscreenCanvas;
		width: number;
		height: number;
		feather: number;
	}): OffscreenCanvas {
		if (!previewGpuAvailable) {
			return maskCanvas;
		}

		return applyMaskFeatherWasm({
			mask: maskCanvas,
			width,
			height,
			feather,
		});
	},
};

function serializeEffectPasses(passes: EffectPass[]) {
	return passes.map((pass) => ({
		shader: pass.shader,
		uniforms: Object.entries(pass.uniforms).map(([name, value]) => ({
			name,
			value: normalizeUniformValue(value),
		})),
	}));
}

function normalizeUniformValue(value: EffectUniformValue): number[] {
	return typeof value === "number" ? [value] : value;
}
