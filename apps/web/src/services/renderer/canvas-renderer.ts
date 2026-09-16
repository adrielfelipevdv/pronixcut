import type { FrameRate } from "opencut-wasm";
import type { AnyBaseNode } from "./nodes/base-node";
import { createCanvasSurface } from "./canvas-utils";
import { buildFrameDescriptor } from "./compositor/frame-descriptor";
import { wasmCompositor } from "./compositor/wasm-compositor";
import { resolveRenderTree } from "./resolve";
import {
	measureSpanAsync,
	measureSpanSync,
	onRenderPerfFrameComplete,
} from "@/diagnostics/render-perf";

export type CanvasRendererParams = {
	width: number;
	height: number;
	fps: FrameRate;
	/**
	 * Ratio between this renderer's actual pixel dimensions and the project's
	 * authored canvas resolution (`project.settings.canvasSize`) — 1 when
	 * they match (export, thumbnails, and full-quality preview all pass this
	 * implicitly by omitting it). When the live Viewer renders at a reduced
	 * "Qualidade da pré-visualização" (see preview-resolution-scale.ts),
	 * `width`/`height` here are already the smaller physical target, but
	 * absolute-pixel values authored against the full project resolution
	 * (element position, mask feather, text stroke width — anything that
	 * isn't already expressed as a ratio against canvas size) need to be
	 * multiplied by this factor wherever they're combined with
	 * `renderer.width`/`renderer.height`, or they'd end up in the wrong
	 * place/proportion on the smaller target. See resolve.ts and
	 * compositor/frame-descriptor.ts for the actual application sites.
	 */
	coordinateScale?: number;
};

export class CanvasRenderer {
	canvas: OffscreenCanvas;
	context: OffscreenCanvasRenderingContext2D;
	width: number;
	height: number;
	fps: FrameRate;
	coordinateScale: number;

	constructor({ width, height, fps, coordinateScale = 1 }: CanvasRendererParams) {
		this.width = width;
		this.height = height;
		this.fps = fps;
		this.coordinateScale = coordinateScale;

		const surface = createCanvasSurface({ width, height });
		this.canvas = surface.canvas;
		this.context = surface.context;
	}

	getOutputCanvas(): HTMLCanvasElement {
		wasmCompositor.ensureInitialized({
			width: this.width,
			height: this.height,
		});
		return wasmCompositor.getCanvas();
	}

	setSize({
		width,
		height,
		coordinateScale = 1,
	}: {
		width: number;
		height: number;
		coordinateScale?: number;
	}) {
		this.width = width;
		this.height = height;
		this.coordinateScale = coordinateScale;

		const surface = createCanvasSurface({ width, height });
		this.canvas = surface.canvas;
		this.context = surface.context;
	}

	async render({ node, time }: { node: AnyBaseNode; time: number }) {
		await measureSpanAsync({
			name: "resolve",
			fn: () => resolveRenderTree({ node, renderer: this, time }),
		});
		const { frame, textures } = await measureSpanAsync({
			name: "buildFrame",
			fn: () => buildFrameDescriptor({ node, renderer: this }),
		});
		wasmCompositor.ensureInitialized({
			width: this.width,
			height: this.height,
		});
		measureSpanSync({
			name: "syncTextures",
			fn: () => wasmCompositor.syncTextures(textures),
		});
		measureSpanSync({
			name: "renderFrame",
			fn: () => wasmCompositor.render(frame),
		});
		// This is the actual per-frame playback path (PreviewCanvas's RAF loop
		// calls render() directly, not renderToCanvas() — that one is only used
		// for one-shot snapshots/thumbnails). onRenderPerfFrameComplete() used to
		// live solely in renderToCanvas(), so window.__renderPerf's rolling
		// summary never accumulated a single sample during real playback.
		onRenderPerfFrameComplete();
	}

	async renderToCanvas({
		node,
		time,
		targetCanvas,
	}: {
		node: AnyBaseNode;
		time: number;
		targetCanvas: HTMLCanvasElement;
	}) {
		await this.render({ node, time });

		const ctx = targetCanvas.getContext("2d");
		if (!ctx) {
			throw new Error("Failed to get target canvas context");
		}

		measureSpanSync({
			name: "drawImage",
			fn: () =>
				ctx.drawImage(
					wasmCompositor.getCanvas(),
					0,
					0,
					targetCanvas.width,
					targetCanvas.height,
				),
		});
	}
}
