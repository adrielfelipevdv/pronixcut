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
// Percentage-point reduction applied to the tools column when the sidebar
// rail collapses — an approximation of the ~132px (188px → 56px) it frees,
// expressed as a share of the panel group rather than a fixed pixel width
// (which the resizable-panels library doesn't work in). Collapsing must
// actually hand this space to the preview, not just reshuffle the tools
// column's own internal split (PART 3, item 26).
const SIDEBAR_COLLAPSE_SIZE_DELTA = 7;

function EditorLayout() {
	usePasteMedia();
	const { panels, setPanel } = usePanelStore();
	const isExpandedPreview = useExpandedPreviewStore((s) => s.isExpanded);
	const sidebarCollapsed = useAssetsPanelStore((s) => s.sidebarCollapsed);
	const { selectedElements } = useElementSelection();
	// The inspector only ever takes up space when there's something for it to
	// show — never an empty placeholder — and expanded-preview mode
	// deliberately suppresses it even with a selection, so the vertical video
	// never gets compressed back down by it (PART 2, item 15).
	const showInspector = selectedElements.length > 0 && !isExpandedPreview;
	const toolsPanelRef = useRef<ImperativePanelHandle>(null);
	const isProgrammaticResizeRef = useRef(false);
	const savedToolsSizeRef = useRef<number | null>(null);

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
			const target = sidebarCollapsed
				? Math.max(4, base - SIDEBAR_COLLAPSE_SIZE_DELTA)
				: base;
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
						minSize={8}
						maxSize={40}
						className="min-w-0"
					>
						<AssetsPanel />
					</ResizablePanel>

					<ResizableHandle withHandle />

					<ResizablePanel
						defaultSize={
							showInspector ? panels.preview : panels.preview + panels.properties
						}
						minSize={30}
						className="min-h-0 min-w-0 flex-1"
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
								defaultSize={panels.properties}
								minSize={8}
								maxSize={40}
								className="min-w-0"
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
