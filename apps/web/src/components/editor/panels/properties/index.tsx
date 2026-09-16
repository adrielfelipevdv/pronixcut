"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditor } from "@/editor/use-editor";
import { useElementSelection } from "@/timeline/hooks/element/use-element-selection";
import { usePropertiesStore } from "./stores/properties-store";
import { getPropertiesConfig } from "./registry";
import { cn } from "@/utils/ui";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";

// The caller (EditorLayout) only mounts this panel at all when there's a
// selection — see PART 1 of the "remove the empty inspector" change — so
// this component never needs to render an empty/placeholder state itself.
// Kept as a defensive no-op rather than removed entirely in case something
// else ever mounts this panel without checking selection first.
export function PropertiesPanel() {
	const editor = useEditor();
	useEditor((e) => e.scenes.getActiveSceneOrNull());
	useEditor((e) => e.media.getAssets());
	// `previewElements` (live typing/dragging before blur/commit) only touches
	// timeline-manager's own preview overlay — it never touches scenes-manager,
	// so the two selectors above never see a changed snapshot while a preview
	// is in progress and this panel doesn't re-render. Subscribing to
	// `getPreviewTracks()` here (same accessor the Viewer already uses to stay
	// live during typing) is what makes the Inspector re-render on every
	// keystroke instead of only once selection/commit changes.
	useEditor((e) => e.timeline.getPreviewTracks());
	const { selectedElements } = useElementSelection();
	const { activeTabPerType, setActiveTab } = usePropertiesStore();
	const inspectorCollapsed = usePropertiesStore((s) => s.inspectorCollapsed);
	const toggleInspectorCollapsed = usePropertiesStore(
		(s) => s.toggleInspectorCollapsed,
	);

	if (selectedElements.length === 0) {
		return null;
	}

	// Collapsing only changes what's rendered here — the selection, the
	// element's params, and any in-progress edit all live untouched in the
	// editor/timeline state, so re-expanding shows exactly what was there.
	if (inspectorCollapsed) {
		return <CollapsedInspectorRail onExpand={toggleInspectorCollapsed} />;
	}

	if (selectedElements.length > 1) {
		return (
			<div className="panel bg-background border-border relative flex h-full flex-col items-center justify-center overflow-hidden rounded-[10px] border">
				<p className="text-muted-foreground text-sm">
					{selectedElements.length} elementos selecionados
				</p>
				<CollapseToggleButton
					collapsed={false}
					onToggle={toggleInspectorCollapsed}
				/>
			</div>
		);
	}

	const mediaAssets = editor.media.getAssets();

	const elementsWithTracks = editor.timeline.getElementsWithTracks({
		elements: selectedElements,
	});
	const elementWithTrack = elementsWithTracks[0];

	if (!elementWithTrack) return null;

	const { element, track } = elementWithTrack;
	const config = getPropertiesConfig({ element, mediaAssets });
	const visibleTabs = config.tabs;

	const storedTabId = activeTabPerType[element.type];
	const isStoredTabVisible = visibleTabs.some((t) => t.id === storedTabId);
	const activeTabId = isStoredTabVisible ? storedTabId : config.defaultTab;
	const activeTab =
		visibleTabs.find((t) => t.id === activeTabId) ?? visibleTabs[0];

	if (!activeTab) return null;

	return (
		<div className="panel bg-background border-border flex h-full flex-col overflow-hidden rounded-[10px] border">
			<div className="border-border flex h-11 shrink-0 items-center gap-1 border-b px-1.5">
				<div className="scrollbar-hidden flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto">
					{visibleTabs.map((tab) => {
						const active = tab.id === activeTab.id;
						return (
							<button
								key={tab.id}
								type="button"
								onClick={() =>
									setActiveTab({
										elementType: element.type,
										tabId: tab.id,
									})
								}
								className={cn(
									"relative flex h-9 shrink-0 items-center whitespace-nowrap rounded-md px-2.5 text-[13px] font-medium transition-colors duration-150",
									active
										? "text-foreground"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{tab.label}
								{active && (
									<span className="bg-primary absolute inset-x-2 -bottom-px h-0.5 rounded-full" />
								)}
							</button>
						);
					})}
				</div>
				<CollapseToggleButton
					collapsed={false}
					onToggle={toggleInspectorCollapsed}
				/>
			</div>
			<ScrollArea className="scrollbar-hidden flex-1">
				{activeTab.content({ trackId: track.id })}
			</ScrollArea>
		</div>
	);
}

function CollapsedInspectorRail({ onExpand }: { onExpand: () => void }) {
	return (
		<div className="panel bg-background border-border flex h-full w-full flex-col items-center overflow-hidden rounded-[10px] border pt-2">
			<CollapseToggleButton collapsed onToggle={onExpand} />
		</div>
	);
}

function CollapseToggleButton({
	collapsed,
	onToggle,
}: {
	collapsed: boolean;
	onToggle: () => void;
}) {
	return (
		<TooltipProvider delayDuration={200}>
			<Tooltip>
				<TooltipTrigger asChild>
					<button
						type="button"
						onClick={onToggle}
						aria-label={collapsed ? "Expandir inspector" : "Recolher inspector"}
						className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-7 shrink-0 items-center justify-center rounded-md transition-colors duration-150"
					>
						<HugeiconsIcon
							icon={collapsed ? ArrowRight01Icon : ArrowLeft01Icon}
							className="size-4"
						/>
					</button>
				</TooltipTrigger>
				<TooltipContent side={collapsed ? "left" : "bottom"}>
					{collapsed ? "Expandir inspector" : "Recolher inspector"}
				</TooltipContent>
			</Tooltip>
		</TooltipProvider>
	);
}
