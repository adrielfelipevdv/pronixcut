"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import useDeepCompareEffect from "use-deep-compare-effect";
import { useEditor } from "@/editor/use-editor";
import { useRafLoop } from "@/hooks/use-raf-loop";
import { useContainerSize } from "@/hooks/use-container-size";
import { useFullscreen } from "@/hooks/use-fullscreen";
import { CanvasRenderer } from "@/services/renderer/canvas-renderer";
import { TICKS_PER_SECOND } from "@/wasm";
import type { RootNode } from "@/services/renderer/nodes/root-node";
import { buildScene } from "@/services/renderer/scene-builder";
import { PreviewOverlayLayer } from "./overlay-layer";
import { PreviewInteractionOverlay } from "./preview-interaction-overlay";
import { ContextMenu, ContextMenuTrigger } from "@/components/ui/context-menu";
import type {
	PreviewOverlayControl,
	PreviewOverlayInstance,
} from "@/preview/overlays";
import { PreviewContextMenu } from "./context-menu";
import { PreviewToolbar } from "./toolbar";
import {
	PreviewViewportProvider,
	usePreviewViewportState,
} from "./preview-viewport";
import { SidePreviewPane } from "./side-preview";
import { useSidePreviewStore } from "@/preview/side-preview-store";
import { usePreviewStore } from "@/preview/preview-store";
import { resolveEffectivePreviewResolution } from "@/preview/preview-resolution-scale";
import { resolvePlaybackMediaAssets } from "@/media/playback-source";
import { hasMediaId } from "@/timeline/element-utils";

function usePreviewSize() {
	const canvasSize = useEditor(
		(e) => e.project.getActive()?.settings.canvasSize,
	);

	return {
		width: canvasSize?.width,
		height: canvasSize?.height,
	};
}

/**
 * "Qualidade da pré-visualização" — an editor preference (never project
 * content), independently persisted in `usePreviewStore`. Resolves to a
 * physical render-target size for the Viewer's compositor/effects pipeline
 * ONLY — `project.settings.canvasSize` (aspect ratio, coordinate space every
 * element's params are authored against) is never touched, and this value
 * never reaches export (SceneExporter/renderer-manager build their own
 * CanvasRenderer at export-resolved size, entirely independent of this
 * store). See preview-resolution-scale.ts for the scale rules and
 * canvas-renderer.ts's `coordinateScale` for how absolute-pixel values
 * (position, mask feather, text stroke) stay correctly proportioned on the
 * smaller target.
 */
function usePreviewResolutionScale({
	nativeWidth,
	nativeHeight,
}: {
	nativeWidth?: number;
	nativeHeight?: number;
}) {
	const setting = usePreviewStore((s) => s.previewResolutionScale);

	return useMemo(() => {
		if (!nativeWidth || !nativeHeight) {
			return { scale: 1, indicatorLabel: null, width: nativeWidth, height: nativeHeight };
		}
		const { scale, indicatorLabel } = resolveEffectivePreviewResolution({
			setting,
			canvasSize: { width: nativeWidth, height: nativeHeight },
		});
		return {
			scale,
			indicatorLabel,
			width: Math.max(1, Math.round(nativeWidth * scale)),
			height: Math.max(1, Math.round(nativeHeight * scale)),
		};
	}, [setting, nativeWidth, nativeHeight]);
}

function normalizeWheelDelta({
	delta,
	deltaMode,
	pageSize,
}: {
	delta: number;
	deltaMode: number;
	pageSize: number;
}): number {
	if (deltaMode === WheelEvent.DOM_DELTA_LINE) {
		return delta * 16;
	}

	if (deltaMode === WheelEvent.DOM_DELTA_PAGE) {
		return delta * pageSize;
	}

	return delta;
}

export function PreviewPanel({
	overlayControls,
	overlayInstances,
	onOverlayVisibilityChange,
}: {
	overlayControls: PreviewOverlayControl[];
	overlayInstances: PreviewOverlayInstance[];
	onOverlayVisibilityChange: (params: {
		overlayId: string;
		isVisible: boolean;
	}) => void;
}) {
	const containerRef = useRef<HTMLDivElement>(null);
	const [container, setContainer] = useState<HTMLDivElement | null>(null);
	const { toggleFullscreen } = useFullscreen({ containerRef });
	const handleContainerRef = useCallback((node: HTMLDivElement | null) => {
		containerRef.current = node;
		setContainer(node);
	}, []);

	return (
		<div
			ref={handleContainerRef}
			className="panel bg-background border-border relative flex size-full min-h-0 min-w-0 flex-col overflow-hidden rounded-[10px] border"
		>
			<PreviewCanvas
				container={container}
				onToggleFullscreen={toggleFullscreen}
				overlayControls={overlayControls}
				overlayInstances={overlayInstances}
				onOverlayVisibilityChange={onOverlayVisibilityChange}
			/>
			<RenderTreeController />
		</div>
	);
}

function gcd({ a, b }: { a: number; b: number }): number {
	return b === 0 ? a : gcd({ a: b, b: a % b });
}

function formatAspectRatioLabel({
	width,
	height,
}: {
	width?: number;
	height?: number;
}): string | null {
	if (!width || !height) return null;
	const divisor = gcd({ a: Math.round(width), b: Math.round(height) }) || 1;
	return `${Math.round(width / divisor)}:${Math.round(height / divisor)}`;
}

function AspectRatioBadge({
	width,
	height,
}: {
	width?: number;
	height?: number;
}) {
	const label = formatAspectRatioLabel({ width, height });
	if (!label) return null;

	return (
		<div className="bg-elevated/90 border-border text-muted-foreground pointer-events-none absolute top-3 left-3 z-10 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium backdrop-blur-sm">
			{label}
		</div>
	);
}

function PreviewQualityBadge({ label }: { label: string | null }) {
	if (!label) return null;

	return (
		<div
			className="bg-elevated/90 border-border text-muted-foreground pointer-events-none absolute top-11 left-3 z-10 flex items-center gap-1.5 rounded-md border px-2 py-1 text-[11px] font-medium backdrop-blur-sm"
			title={`Qualidade da pré-visualização: ${label}`}
		>
			{label}
		</div>
	);
}

// Shown in place of the black frame a browser-undecodable source (HEVC/H.265
// etc.) would otherwise leave on screen while its H.264 proxy is generated —
// see MediaManager.startPreviewProxyGeneration.
function ProxyPreparingOverlay({ progress }: { progress: number | undefined }) {
	return (
		<div className="pointer-events-none absolute inset-0 z-20 flex flex-col items-center justify-center gap-3 bg-black/85 px-6 text-center text-white">
			<div className="size-8 animate-spin rounded-full border-[3px] border-white/20 border-t-white" />
			<p className="text-sm font-medium">Preparando vídeo para edição...</p>
			{typeof progress === "number" && (
				<div className="h-1.5 w-48 overflow-hidden rounded-full bg-white/20">
					<div
						className="h-full rounded-full bg-white transition-[width]"
						style={{ width: `${Math.round(Math.min(100, Math.max(0, progress)))}%` }}
					/>
				</div>
			)}
		</div>
	);
}

function RenderTreeController() {
	const editor = useEditor();
	const tracks = useEditor(
		(e) => e.timeline.getPreviewTracks() ?? e.scenes.getActiveScene().tracks,
	);
	const mediaAssets = useEditor((e) => e.media.getAssets());
	const activeProject = useEditor((e) => e.project.getActive());

	const { width, height } = usePreviewSize();
	const { width: renderWidth, height: renderHeight } = usePreviewResolutionScale({
		nativeWidth: width,
		nativeHeight: height,
	});

	useDeepCompareEffect(() => {
		if (!activeProject || renderWidth === undefined || renderHeight === undefined) {
			return;
		}

		const duration = editor.timeline.getTotalDuration();
		const playbackMediaAssets = resolvePlaybackMediaAssets({
			mediaAssets,
			proxyFileByMediaId: (asset) => asset.previewProxyFile,
		});
		const renderTree = buildScene({
			tracks,
			mediaAssets: playbackMediaAssets,
			duration,
			canvasSize: { width: renderWidth, height: renderHeight },
			background: activeProject.settings.background,
			isPreview: true,
		});

		editor.renderer.setRenderTree({ renderTree });
	}, [
		tracks,
		mediaAssets,
		activeProject?.settings.background,
		renderWidth,
		renderHeight,
	]);

	return null;
}

function PreviewCanvas({
	container,
	onToggleFullscreen,
	overlayControls,
	overlayInstances,
	onOverlayVisibilityChange,
}: {
	container: HTMLElement | null;
	onToggleFullscreen: () => void;
	overlayControls: PreviewOverlayControl[];
	overlayInstances: PreviewOverlayInstance[];
	onOverlayVisibilityChange: (params: {
		overlayId: string;
		isVisible: boolean;
	}) => void;
}) {
	const canvasMountRef = useRef<HTMLDivElement>(null);
	const viewportRef = useRef<HTMLDivElement>(null);
	const lastFrameRef = useRef(-1);
	const lastSceneRef = useRef<RootNode | null>(null);
	const renderingRef = useRef(false);
	const { width: nativeWidth, height: nativeHeight } = usePreviewSize();
	const {
		scale: previewScale,
		indicatorLabel: previewQualityIndicator,
		width: renderWidth,
		height: renderHeight,
	} = usePreviewResolutionScale({ nativeWidth, nativeHeight });
	const viewportSize = useContainerSize({ containerRef: viewportRef });
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());
	const renderTree = useEditor((e) => e.renderer.getRenderTree());
	const mediaAssets = useEditor((e) => e.media.getAssets());
	const previewTracks = useEditor(
		(e) => e.timeline.getPreviewTracks() ?? e.scenes.getActiveScene().tracks,
	);
	const preparingAsset = useMemo(() => {
		const usedMediaIds = new Set<string>();
		for (const track of [...previewTracks.overlay, previewTracks.main]) {
			for (const element of track.elements) {
				if (hasMediaId(element)) usedMediaIds.add(element.mediaId);
			}
		}
		return mediaAssets.find(
			(asset) =>
				usedMediaIds.has(asset.id) &&
				(asset.previewProxyStatus === "pending" ||
					asset.previewProxyStatus === "generating"),
		);
	}, [mediaAssets, previewTracks]);
	// Viewport/CSS sizing and pointer↔canvas conversion (drag handles, zoom,
	// pan) always use the project's real canvasSize (`nativeWidth/Height`) —
	// never the reduced preview render size — so the Viewer's on-screen
	// footprint and every drag/handle computation stay exactly the same
	// regardless of "Qualidade da pré-visualização".
	const viewport = usePreviewViewportState({
		canvasHeight: nativeHeight,
		canvasWidth: nativeWidth,
		viewportHeight: viewportSize.height,
		viewportRef,
		viewportWidth: viewportSize.width,
	});
	const { canPan, panByScreenDelta, scaleZoom } = viewport;

	const renderer = useMemo(() => {
		return new CanvasRenderer({
			width: renderWidth ?? nativeWidth,
			height: renderHeight ?? nativeHeight,
			fps: activeProject.settings.fps,
			coordinateScale: previewScale,
		});
	}, [renderWidth, renderHeight, nativeWidth, nativeHeight, activeProject.settings.fps, previewScale]);

	// Mount the compositor's output canvas directly into the preview. wgpu
	// renders straight into this element, so there is no intermediate copy —
	// the container div owns positioning/styling, the canvas itself fills it.
	useEffect(() => {
		const mount = canvasMountRef.current;
		if (!mount) return;
		const outputCanvas = renderer.getOutputCanvas();
		outputCanvas.style.display = "block";
		outputCanvas.style.width = "100%";
		outputCanvas.style.height = "100%";
		mount.appendChild(outputCanvas);
		return () => {
			if (outputCanvas.parentElement === mount) {
				mount.removeChild(outputCanvas);
			}
		};
	}, [renderer]);

	const render = useCallback(() => {
		if (!renderTree || renderingRef.current) return;

		const renderTime = Math.min(
			editor.playback.getCurrentTime(),
			editor.timeline.getLastFrameTime(),
		);
		const ticksPerFrame = Math.round(
			(TICKS_PER_SECOND * renderer.fps.denominator) / renderer.fps.numerator,
		);
		const frame = Math.floor(renderTime / ticksPerFrame);

		if (
			frame === lastFrameRef.current &&
			renderTree === lastSceneRef.current
		) {
			return;
		}

		renderingRef.current = true;
		lastSceneRef.current = renderTree;
		lastFrameRef.current = frame;
		renderer
			.render({ node: renderTree, time: renderTime })
			.catch((error) => {
				// A single failed frame (decoder hiccup, GPU texture upload
				// failure, transient OOM) must never permanently wedge playback.
				// Without this catch, a rejection here left renderingRef stuck
				// `true` forever — every later RAF tick would bail out at the
				// guard above, freezing the canvas on the last good frame while
				// the playhead/timecode kept advancing normally.
				console.error("Preview render failed:", error);
			})
			.finally(() => {
				renderingRef.current = false;
			});
	}, [renderer, renderTree, editor.playback, editor.timeline]);

	useRafLoop(render);

	useEffect(() => {
		const container = viewportRef.current;
		if (!container) return;

		let pendingZoomDelta = 0;
		let pendingPanDeltaX = 0;
		let pendingPanDeltaY = 0;
		let zoomRafId: ReturnType<typeof requestAnimationFrame> | null = null;
		let panRafId: ReturnType<typeof requestAnimationFrame> | null = null;

		const onWheel = (event: WheelEvent) => {
			const normalizedDeltaX = normalizeWheelDelta({
				delta: event.deltaX,
				deltaMode: event.deltaMode,
				pageSize: container.clientWidth,
			});
			const normalizedDeltaY = normalizeWheelDelta({
				delta: event.deltaY,
				deltaMode: event.deltaMode,
				pageSize: container.clientHeight,
			});
			const isZoomGesture = event.ctrlKey || event.metaKey;
			if (isZoomGesture) {
				event.preventDefault();
				pendingZoomDelta += normalizedDeltaY;

				if (zoomRafId === null) {
					zoomRafId = requestAnimationFrame(() => {
						const cappedDelta =
							Math.sign(pendingZoomDelta) *
							Math.min(Math.abs(pendingZoomDelta), 30);
						const zoomFactor = Math.exp(-cappedDelta / 300);

						scaleZoom({ factor: zoomFactor });
						pendingZoomDelta = 0;
						zoomRafId = null;
					});
				}

				return;
			}

			if (!canPan) {
				return;
			}

			if (normalizedDeltaX === 0 && normalizedDeltaY === 0) {
				return;
			}

			event.preventDefault();
			pendingPanDeltaX += normalizedDeltaX;
			pendingPanDeltaY += normalizedDeltaY;

			if (panRafId === null) {
				panRafId = requestAnimationFrame(() => {
					panByScreenDelta({
						deltaX: pendingPanDeltaX,
						deltaY: pendingPanDeltaY,
					});
					pendingPanDeltaX = 0;
					pendingPanDeltaY = 0;
					panRafId = null;
				});
			}
		};

		container.addEventListener("wheel", onWheel, {
			capture: true,
			passive: false,
		});

		return () => {
			container.removeEventListener("wheel", onWheel, {
				capture: true,
			});
			if (zoomRafId !== null) {
				cancelAnimationFrame(zoomRafId);
			}
			if (panRafId !== null) {
				cancelAnimationFrame(panRafId);
			}
		};
	}, [canPan, panByScreenDelta, scaleZoom]);

	const isVertical = nativeHeight !== undefined && nativeWidth !== undefined
		? nativeHeight > nativeWidth
		: false;
	const isSidePreviewEnabled = useSidePreviewStore((s) => s.isEnabled);
	const setSidePreviewEnabled = useSidePreviewStore((s) => s.setEnabled);
	const showSidePreview = isVertical && isSidePreviewEnabled;

	return (
		<PreviewViewportProvider value={viewport}>
			<div className="flex size-full min-h-0 min-w-0 flex-col">
				<div className="relative flex min-h-0 min-w-0 flex-1 gap-2 p-2 pb-0">
					<div className="relative flex min-h-0 min-w-0 flex-1">
					<AspectRatioBadge width={nativeWidth} height={nativeHeight} />
					<PreviewQualityBadge label={previewQualityIndicator} />
					<ContextMenu>
						<ContextMenuTrigger asChild>
							<div
								ref={viewportRef}
								className="relative flex size-full min-h-0 min-w-0 items-center justify-center overflow-hidden"
							>
							<div
								ref={canvasMountRef}
								className="absolute block border"
								style={{
									left: viewport.sceneLeft,
									top: viewport.sceneTop,
									width: viewport.sceneWidth,
									height: viewport.sceneHeight,
									background:
										activeProject.settings.background.type === "blur"
											? "transparent"
											: activeProject?.settings.background.color,
								}}
							/>
								{preparingAsset && (
									<ProxyPreparingOverlay progress={preparingAsset.previewProxyProgress} />
								)}
								<PreviewOverlayLayer
									instances={overlayInstances}
									plane="under-interaction"
								/>
								<PreviewInteractionOverlay />
								<PreviewOverlayLayer
									instances={overlayInstances}
									plane="over-interaction"
								/>
							</div>
						</ContextMenuTrigger>
						<PreviewContextMenu
							onToggleFullscreen={onToggleFullscreen}
							container={container}
							overlayControls={overlayControls}
							onOverlayVisibilityChange={onOverlayVisibilityChange}
						/>
					</ContextMenu>
					</div>
					{showSidePreview && (
						<SidePreviewPane
							sourceCanvas={renderer.getOutputCanvas()}
							onClose={() => setSidePreviewEnabled(false)}
						/>
					)}
				</div>
				<PreviewToolbar onToggleFullscreen={onToggleFullscreen} />
			</div>
		</PreviewViewportProvider>
	);
}
