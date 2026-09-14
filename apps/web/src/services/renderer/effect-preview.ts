import { createCanvasSurface } from "./canvas-utils";
import { effectsRegistry, isCanvas2DEffect, resolveEffectPasses } from "@/effects";
import { buildDefaultParamValues } from "@/params/registry";
import type { ParamValues } from "@/params";
import type { Canvas2DEffectRendererConfig } from "@/effects/types";
import { gpuRenderer } from "./gpu-renderer";

const PREVIEW_SIZE = 160;
const PREVIEW_IMAGE_PATH = "/effects/preview.jpg";

class EffectPreviewService {
	private testSourceCanvas: OffscreenCanvas | null = null;
	private previewImageElement: HTMLImageElement | null = null;
	// A real frame of the project currently being edited, captured on demand
	// (clip selection change, explicit refresh) — never re-captured on every
	// playback tick. Takes priority over the generic stock photo once set.
	private referenceFrameCanvas: OffscreenCanvas | null = null;
	private onReadyCallbacks = new Set<() => void>();

	readonly PREVIEW_SIZE = PREVIEW_SIZE;

	constructor() {
		this.loadPreviewImage();
	}

	onPreviewImageReady({ callback }: { callback: () => void }): () => void {
		this.onReadyCallbacks.add(callback);
		return () => this.onReadyCallbacks.delete(callback);
	}

	hasReferenceFrame(): boolean {
		return this.referenceFrameCanvas !== null;
	}

	/** Captures a real frame from the project as the preview source (cover-fit into the square preview), replacing the generic stock photo. Pass null to clear it and fall back to the stock photo again. */
	setReferenceFrame({ source }: { source: CanvasImageSource | null }): void {
		if (!source) {
			this.referenceFrameCanvas = null;
			this.notifyReady();
			return;
		}

		const { canvas, context } = createCanvasSurface({
			width: PREVIEW_SIZE,
			height: PREVIEW_SIZE,
		});
		const { width: sourceWidth, height: sourceHeight } = getSourceDimensions(source);
		if (sourceWidth > 0 && sourceHeight > 0) {
			const coverScale = Math.max(PREVIEW_SIZE / sourceWidth, PREVIEW_SIZE / sourceHeight);
			const drawWidth = sourceWidth * coverScale;
			const drawHeight = sourceHeight * coverScale;
			context.drawImage(
				source,
				(PREVIEW_SIZE - drawWidth) / 2,
				(PREVIEW_SIZE - drawHeight) / 2,
				drawWidth,
				drawHeight,
			);
		}
		this.referenceFrameCanvas = canvas;
		this.notifyReady();
	}

	private notifyReady(): void {
		for (const callback of this.onReadyCallbacks) {
			callback();
		}
	}

	renderPreview({
		effectType,
		params,
		targetCanvas,
		uniformDimensions,
	}: {
		effectType: string;
		params: ParamValues;
		targetCanvas: HTMLCanvasElement;
		uniformDimensions?: { width: number; height: number };
	}): void {
		const size = PREVIEW_SIZE;
		const targetCtx = targetCanvas.getContext(
			"2d",
		) as CanvasRenderingContext2D | null;
		if (!targetCtx) {
			return;
		}

		targetCanvas.width = size;
		targetCanvas.height = size;

		const source = this.getTestSource({ width: size, height: size });
		if (!source) {
			targetCtx.clearRect(0, 0, size, size);
			return;
		}

		try {
			const definition = effectsRegistry.get(effectType);
			const resolvedParams =
				Object.keys(params).length > 0
					? params
					: buildDefaultParamValues(definition.params);

			if (isCanvas2DEffect({ definition })) {
				const renderer = definition.renderer as Canvas2DEffectRendererConfig;
				targetCtx.save();
				targetCtx.filter = renderer.filter?.({ effectParams: resolvedParams }) || "none";
				targetCtx.drawImage(source, 0, 0, size, size);
				targetCtx.restore();
				renderer.overlay?.({ ctx: targetCtx, width: size, height: size, effectParams: resolvedParams });
				return;
			}

			const passes = resolveEffectPasses({
				definition,
				effectParams: resolvedParams,
				width: uniformDimensions?.width ?? size,
				height: uniformDimensions?.height ?? size,
			});
			const result = this.applyGpuEffect({
				source,
				width: size,
				height: size,
				passes,
			});

			targetCtx.drawImage(result, 0, 0, size, size);
		} catch (error) {
			console.warn("Failed to render effect preview", { effectType, error });
			targetCtx.clearRect(0, 0, size, size);
			targetCtx.drawImage(source, 0, 0, size, size);
		}
	}

	private loadPreviewImage(): void {
		if (typeof window === "undefined") return;
		const image = new Image();
		image.onload = () => {
			this.testSourceCanvas = null;
			this.notifyReady();
		};
		image.src = PREVIEW_IMAGE_PATH;
		this.previewImageElement = image;
	}

	private createTestSource({
		width,
		height,
	}: {
		width: number;
		height: number;
	}): OffscreenCanvas | null {
		const isImageReady =
			this.previewImageElement?.complete &&
			(this.previewImageElement.naturalWidth ?? 0) > 0;
		if (!isImageReady || !this.previewImageElement) {
			return null;
		}

		const { canvas, context } = createCanvasSurface({ width, height });
		context.drawImage(this.previewImageElement, 0, 0, width, height);
		return canvas;
	}

	private getTestSource({
		width,
		height,
	}: {
		width: number;
		height: number;
	}): OffscreenCanvas | null {
		if (this.referenceFrameCanvas) {
			return this.referenceFrameCanvas;
		}
		if (
			!this.testSourceCanvas ||
			this.testSourceCanvas.width !== width ||
			this.testSourceCanvas.height !== height
		) {
			this.testSourceCanvas = this.createTestSource({ width, height });
		}
		return this.testSourceCanvas;
	}

	private applyGpuEffect({
		source,
		width,
		height,
		passes,
	}: {
		source: OffscreenCanvas;
		width: number;
		height: number;
		passes: ReturnType<typeof resolveEffectPasses>;
	}): OffscreenCanvas {
		return gpuRenderer.applyEffect({
			source,
			width,
			height,
			passes,
		});
	}
}

function getSourceDimensions(source: CanvasImageSource): { width: number; height: number } {
	if (source instanceof HTMLCanvasElement || source instanceof OffscreenCanvas) {
		return { width: source.width, height: source.height };
	}
	if (source instanceof HTMLVideoElement) {
		return { width: source.videoWidth, height: source.videoHeight };
	}
	if (source instanceof HTMLImageElement) {
		return { width: source.naturalWidth, height: source.naturalHeight };
	}
	if (source instanceof ImageBitmap) {
		return { width: source.width, height: source.height };
	}
	return { width: 0, height: 0 };
}

export const effectPreviewService = new EffectPreviewService();
