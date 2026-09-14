"use client";

import { ScrollArea } from "@/components/ui/scroll-area";
import { useEditor } from "@/editor/use-editor";
import { useElementSelection } from "@/timeline/hooks/element/use-element-selection";
import { usePropertiesStore } from "./stores/properties-store";
import { getPropertiesConfig } from "./registry";
import { cn } from "@/utils/ui";

// The caller (EditorLayout) only mounts this panel at all when there's a
// selection — see PART 1 of the "remove the empty inspector" change — so
// this component never needs to render an empty/placeholder state itself.
// Kept as a defensive no-op rather than removed entirely in case something
// else ever mounts this panel without checking selection first.
export function PropertiesPanel() {
	const editor = useEditor();
	useEditor((e) => e.scenes.getActiveSceneOrNull());
	useEditor((e) => e.media.getAssets());
	const { selectedElements } = useElementSelection();
	const { activeTabPerType, setActiveTab } = usePropertiesStore();

	if (selectedElements.length === 0) {
		return null;
	}

	if (selectedElements.length > 1) {
		return (
			<div className="panel bg-background border-border flex h-full flex-col items-center justify-center overflow-hidden rounded-[10px] border">
				<p className="text-muted-foreground text-sm">
					{selectedElements.length} elementos selecionados
				</p>
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
		<div className="panel bg-background border-border flex h-full overflow-hidden rounded-[10px] border">
			<div className="scrollbar-hidden border-border flex w-[132px] shrink-0 flex-col gap-0.5 overflow-y-auto border-r p-2">
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
							aria-label={tab.label}
							className={cn(
								"flex h-9 shrink-0 items-center gap-2 rounded-md border-l-2 border-transparent pl-2 pr-1.5 text-left text-[13px] font-medium transition-colors duration-150",
								active
									? "border-l-primary bg-primary/8 text-primary"
									: "text-muted-foreground hover:bg-accent hover:text-foreground",
							)}
						>
							<span className="shrink-0 [&_svg]:size-[16px]">{tab.icon}</span>
							<span className="truncate">{tab.label}</span>
						</button>
					);
				})}
			</div>
			<ScrollArea className="flex-1 scrollbar-hidden">
				{activeTab.content({ trackId: track.id })}
			</ScrollArea>
		</div>
	);
}
