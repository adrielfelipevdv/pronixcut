"use client";

import { useParams } from "next/navigation";
import type { ImperativePanelHandle } from "react-resizable-panels";
import {
	ResizablePanelGroup,
	ResizablePanel,
	ResizableHandle,
} from "@/components/ui/resizable";
import { useExpandedPreviewStore } from "@/editor/expanded-preview-store";
import { AssetsPanel } from "@/components/editor/panels/assets";
import { PropertiesPanel } from "@/components/editor/panels/properties";
import { Timeline } from "@/timeline/components";
import { PreviewPanel } from "@/preview/components";
import { EditorHeader } from "@/components/editor/editor-header";
import { EditorProvider } from "@/components/providers/editor-provider";
import { MigrationDialog } from "@/project/components/migration-dialog";
import { usePanelStore } from "@/editor/panel-store";
import { usePasteMedia } from "@/media/use-paste-media";
import { MobileGate } from "@/components/editor/mobile-gate";
import { useEffect, useMemo, useRef, useState } from "react";
import { useEditor } from "@/editor/use-editor";
import { useElementSelection } from "@/timeline/hooks/element/use-element-selection";
import { useAssetsPanelStore } from "@/components/editor/panels/assets/assets-panel-store";
import { usePropertiesStore } from "@/components/editor/panels/properties/stores/properties-store";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Button } from "@/components/ui/button";
import {
	createPreviewOverlayControl,
	isPreviewOverlayVisible,
	mergePreviewOverlaySources,
} from "@/preview/overlays";
import { usePreviewStore } from "@/preview/preview-store";
import { getGuidePreviewOverlaySource } from "@/guides";
import {
	bookmarkNotesPreviewOverlay,
	getBookmarkPreviewOverlaySource,
} from "@/timeline/bookmarks/index";
import { RelinkDialog } from "@/project-file/components/relink-dialog";
import { cn } from "@/utils/ui";

export default function Editor() {
	const params = useParams();
	const projectId = params.project_id as string;

	return (
		<MobileGate>
			<EditorProvider projectId={projectId}>
				<div className="bg-background flex h-screen w-screen flex-col overflow-hidden">
					<DegradedRendererBanner />
					<EditorHeader />
					<div className="min-h-0 min-w-0 flex-1">
						<EditorLayout />
					</div>
					<MigrationDialog />
					<RelinkDialog projectId={projectId} />
				</div>
			</EditorProvider>
		</MobileGate>
	);
}

function DegradedRendererBanner() {
	const isDegraded = useEditor((e) => e.renderer.isDegraded);
	const [dismissed, setDismissed] = useState(false);
	if (!isDegraded || dismissed) return null;

	return (
		<div className="bg-accent border-b h-9 flex items-center justify-center gap-2 text-xs text-muted-foreground">
			<span>Para a melhor experiência, abra o PronixCut no Chrome.</span>
			<Button
				variant="text"
				size="icon"
				className="p-0 w-auto [&_svg]:size-3.5"
				onClick={() => setDismissed(true)}
				aria-label="Dismiss"
			>
				<HugeiconsIcon icon={Cancel01Icon} />
			</Button>
		</div>
	);
}

// How much width the tools panel keeps in expanded-preview mode — small
// enough that the preview (now the only other panel in the row, since the
// inspector is suppressed entirely while expanded) claims the rest.
const EXPANDED_PREVIEW_TOOLS_SIZE = 22;
// In expanded-preview mode for a vertical (9:16) project, the preview breaks
// out of the top row entirely and becomes a full-height column on the right
// — beside the timeline too, not just the tools panel above it. This is how
// much of the app's width it claims.
const EXPANDED_PREVIEW_RIGHT_WIDTH = 38;
// How much of the panel group width the whole tools column (icon rail +
// tool panel) keeps once collapsed — just enough for the icon-only rail,
// with the rest handed back to the Preview panel. Collapsing must shrink
// the entire column, not just the rail's own internal split, or the tool
// panel content stays rendered at full width for nothing (see AssetsPanel,
// which hides — not unmounts — its content panel in lockstep with this).
const TOOLS_COLLAPSED_SIZE = 4;
// How much of the panel group width the Inspector keeps when collapsed —
// just enough for the slim "expand" strip, with the rest handed straight to
// the Preview panel (item 31/1: collapsing must actually free the space).
const INSPECTOR_COLLAPSED_SIZE = 3;

function EditorLayout() {
	usePasteMedia();
	const { panels, setPanel } = usePanelStore();
	const isExpandedPreview = useExpandedPreviewStore((s) => s.isExpanded);
	const sidebarCollapsed = useAssetsPanelStore((s) => s.sidebarCollapsed);
	const { selectedElements } = useElementSelection();
	const canvasSize = useEditor((e) => e.project.getActive()?.settings.canvasSize);
	const isVerticalProject = !!canvasSize && canvasSize.height > canvasSize.width;
	// The button that flips isExpandedPreview only ever shows for vertical
	// projects (see ExpandPreviewButton), but the flag itself persists across
	// project switches — re-checking the aspect ratio here keeps a stale
	// "expanded" flag from applying this layout to a horizontal project.
	const showExpandedRightPreview = isExpandedPreview && isVerticalProject;
	// The inspector only ever takes up space when there's something for it to
	// show — never an empty placeholder — and expanded-preview mode
	// deliberately suppresses it even with a selection, so the vertical video
	// never gets compressed back down by it (PART 2, item 15).
	const showInspector = selectedElements.length > 0 && !isExpandedPreview;
	const toolsPanelRef = useRef<ImperativePanelHandle>(null);
	const propertiesPanelRef = useRef<ImperativePanelHandle>(null);
	const isProgrammaticResizeRef = useRef(false);
	const savedToolsSizeRef = useRef<number | null>(null);
	const savedPropertiesSizeRef = useRef<number | null>(null);
	const inspectorCollapsed = usePropertiesStore((s) => s.inspectorCollapsed);

	// Expanded-preview and sidebar-collapsed each want to programmatically
	// shrink the tools panel to free space for the preview — combined here so
	// they compose correctly (item 28) instead of fighting over the same
	// panel ref. Neither ever touches resolution, aspect ratio, export, or
	// element positions, and both are fully reversible. The programmatic-
	// resize guard keeps onLayout below from persisting these temporary sizes
	// over the user's real preference.
	useEffect(() => {
		const toolsPanel = toolsPanelRef.current;
		if (!toolsPanel) return;

		const isOverridden = isExpandedPreview || sidebarCollapsed;

		isProgrammaticResizeRef.current = true;
		if (isOverridden) {
			if (savedToolsSizeRef.current === null) {
				savedToolsSizeRef.current = panels.tools;
			}
			const base = isExpandedPreview
				? EXPANDED_PREVIEW_TOOLS_SIZE
				: savedToolsSizeRef.current;
			const target = sidebarCollapsed ? TOOLS_COLLAPSED_SIZE : base;
			toolsPanel.resize(target);
		} else if (savedToolsSizeRef.current !== null) {
			toolsPanel.resize(savedToolsSizeRef.current);
			savedToolsSizeRef.current = null;
		}
		const releaseGuard = requestAnimationFrame(() => {
			isProgrammaticResizeRef.current = false;
		});
		return () => cancelAnimationFrame(releaseGuard);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [isExpandedPreview, sidebarCollapsed]);

	// Same collapse-and-restore mechanism as the tools panel above, applied to
	// the Inspector: collapsing shrinks it down to a slim strip and hands the
	// freed width straight to the Preview panel; expanding restores the size
	// the user had before. Reuses the same programmatic-resize guard so this
	// doesn't get persisted as the user's real saved width.
	useEffect(() => {
		const propertiesPanel = propertiesPanelRef.current;
		if (!propertiesPanel || !showInspector) return;

		isProgrammaticResizeRef.current = true;
		if (inspectorCollapsed) {
			if (savedPropertiesSizeRef.current === null) {
				savedPropertiesSizeRef.current = panels.properties;
			}
			propertiesPanel.resize(INSPECTOR_COLLAPSED_SIZE);
		} else if (savedPropertiesSizeRef.current !== null) {
			propertiesPanel.resize(savedPropertiesSizeRef.current);
			savedPropertiesSizeRef.current = null;
		}
		const releaseGuard = requestAnimationFrame(() => {
			isProgrammaticResizeRef.current = false;
		});
		return () => cancelAnimationFrame(releaseGuard);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [inspectorCollapsed, showInspector]);
	const activeScene = useEditor((editor) =>
		editor.scenes.getActiveSceneOrNull(),
	);
	const currentTime = useEditor((editor) => editor.playback.getCurrentTime());
	const activeGuide = usePreviewStore((state) => state.activeGuide);
	const overlays = usePreviewStore((state) => state.overlays);
	const setOverlayVisibility = usePreviewStore(
		(state) => state.setOverlayVisibility,
	);
	const showBookmarkNotes = isPreviewOverlayVisible({
		overlay: bookmarkNotesPreviewOverlay,
		overlays,
	});

	const overlaySource = useMemo(
		() =>
			mergePreviewOverlaySources({
				sources: [
					getGuidePreviewOverlaySource({
						guideId: activeGuide,
					}),
					activeScene
						? getBookmarkPreviewOverlaySource({
								bookmarks: activeScene.bookmarks,
								time: currentTime,
								isVisible: showBookmarkNotes,
							})
						: {
								definitions: [bookmarkNotesPreviewOverlay],
								instances: [],
							},
				],
			}),
		[activeGuide, activeScene, currentTime, showBookmarkNotes],
	);

	const overlayControls = useMemo(
		() =>
			overlaySource.definitions.map((overlay) =>
				createPreviewOverlayControl({ overlay, overlays }),
			),
		[overlaySource.definitions, overlays],
	);

	// Expanded preview for a vertical (9:16) project: the preview breaks out
	// of the top row and becomes a full-height column on the right, beside
	// the timeline as well — not just the tools panel. Tools + timeline stack
	// in the remaining left region. The inspector stays suppressed
	// (showInspector already accounts for isExpandedPreview above). This is a
	// separate JSX branch rather than forcing one panel tree to handle both
	// shapes — the timeline and tools panels are still the same components
	// with the same state, just arranged differently.
	if (showExpandedRightPreview) {
		return (
			<ResizablePanelGroup direction="horizontal" className="size-full gap-2 px-3 pt-2 pb-3">
				<ResizablePanel
					defaultSize={100 - EXPANDED_PREVIEW_RIGHT_WIDTH}
					minSize={30}
					className="min-h-0 min-w-0"
				>
					<ResizablePanelGroup
						direction="vertical"
						className="size-full gap-2"
						onLayout={(sizes) => {
							setPanel({
								panel: "mainContent",
								size: sizes[0] ?? panels.mainContent,
							});
							setPanel({
								panel: "timeline",
								size: sizes[1] ?? panels.timeline,
							});
						}}
					>
						<ResizablePanel
							defaultSize={panels.mainContent}
							minSize={30}
							maxSize={85}
							className="min-h-0 min-w-0"
						>
							<AssetsPanel />
						</ResizablePanel>

						<ResizableHandle withHandle />

						<ResizablePanel
							defaultSize={panels.timeline}
							minSize={15}
							maxSize={70}
							className="min-h-0"
						>
							<Timeline />
						</ResizablePanel>
					</ResizablePanelGroup>
				</ResizablePanel>

				<ResizableHandle withHandle />

				<ResizablePanel
					defaultSize={EXPANDED_PREVIEW_RIGHT_WIDTH}
					minSize={25}
					maxSize={55}
					className="min-h-0 min-w-0"
				>
					<PreviewPanel
						overlayControls={overlayControls}
						overlayInstances={overlaySource.instances}
						onOverlayVisibilityChange={setOverlayVisibility}
					/>
				</ResizablePanel>
			</ResizablePanelGroup>
		);
	}

	return (
		<ResizablePanelGroup
			direction="vertical"
			className="size-full gap-2 pt-2"
			onLayout={(sizes) => {
				setPanel({
					panel: "mainContent",
					size: sizes[0] ?? panels.mainContent,
				});
				setPanel({
					panel: "timeline",
					size: sizes[1] ?? panels.timeline,
				});
			}}
		>
			<ResizablePanel
				defaultSize={panels.mainContent}
				minSize={30}
				maxSize={85}
				className="min-h-0"
			>
				<ResizablePanelGroup
					key={showInspector ? "with-inspector" : "no-inspector"}
					direction="horizontal"
					className="size-full gap-2 px-3"
					onLayout={(sizes) => {
						if (isProgrammaticResizeRef.current) return;
						setPanel({ panel: "tools", size: sizes[0] ?? panels.tools });
						setPanel({ panel: "preview", size: sizes[1] ?? panels.preview });
						if (sizes[2] !== undefined) {
							setPanel({ panel: "properties", size: sizes[2] });
						}
					}}
				>
					<ResizablePanel
						ref={toolsPanelRef}
						defaultSize={panels.tools}
						minSize={TOOLS_COLLAPSED_SIZE}
						maxSize={40}
						className={cn(
							// react-resizable-panels sets this panel's width from a
							// percentage of the row (`panels.tools`), which at common
							// window widths comes out well under what the icon rail +
							// AssetsPanel's own `min-w-[280px]` content need. `min-w-0`
							// here let the panel render narrower than that content, so
							// the content silently overflowed behind the panel's
							// `overflow-hidden` instead of ever being visible — every
							// tool tab (Mídia, Efeitos, Ajustes, Legendas, ...) rendered
							// blank. This floor (icon rail ~188px + the 280px content
							// floor) makes the ResizablePanel itself — not just its
							// child — refuse to shrink past what its content needs; the
							// sibling Preview/Properties panels give up the space instead
							// (they don't set their own conflicting min-width floor).
							// Collapsed (`TOOLS_COLLAPSED_SIZE`) still overrides this via
							// the panel's own `.resize()` call above, which isn't a CSS
							// min-width and so isn't blocked by this floor.
							!sidebarCollapsed && "min-w-[468px]",
							"transition-[flex-grow,flex-basis] duration-150 ease-out",
						)}
					>
						<AssetsPanel />
					</ResizablePanel>

					<ResizableHandle withHandle />

					<ResizablePanel
						defaultSize={
							showInspector ? panels.preview : panels.preview + panels.properties
						}
						minSize={30}
						className="min-h-0 min-w-0 flex-1 transition-[flex-grow,flex-basis] duration-150 ease-out"
					>
						<PreviewPanel
							overlayControls={overlayControls}
							overlayInstances={overlaySource.instances}
							onOverlayVisibilityChange={setOverlayVisibility}
						/>
					</ResizablePanel>

					{showInspector && (
						<>
							<ResizableHandle withHandle />

							<ResizablePanel
								ref={propertiesPanelRef}
								defaultSize={panels.properties}
								minSize={INSPECTOR_COLLAPSED_SIZE}
								maxSize={40}
								className="min-w-0 transition-[flex-grow,flex-basis] duration-150 ease-out"
							>
								<div className="animate-in fade-in h-full duration-150">
									<PropertiesPanel />
								</div>
							</ResizablePanel>
						</>
					)}
				</ResizablePanelGroup>
			</ResizablePanel>

			<ResizableHandle withHandle />

			<ResizablePanel
				defaultSize={panels.timeline}
				minSize={15}
				maxSize={70}
				className="min-h-0 px-3 pb-3"
			>
				<Timeline />
			</ResizablePanel>
		</ResizablePanelGroup>
	);
}
