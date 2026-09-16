"use client";

import { Separator } from "@/components/ui/separator";
import { type Tab, useAssetsPanelStore } from "@/components/editor/panels/assets/assets-panel-store";
import { cn } from "@/utils/ui";
import { TabBar } from "./tabbar";
import { Captions } from "@/subtitles/components/assets-view";
import { MediaView } from "./views/assets";
import { SoundsView } from "@/sounds/components/assets-view";
import { StickersView } from "@/stickers/components/assets-view";
import { TextView } from "@/text/components/assets-view";
import { EffectsView } from "@/effects/components/assets-view";
import { AdjustmentsView } from "@/adjustments/components/assets-view";
import { PronixEditorShell } from "@/pronix-editor/components/shell";

export function AssetsPanel() {
	const { activeTab, sidebarCollapsed } = useAssetsPanelStore();

	const viewMap: Record<Tab, React.ReactNode> = {
		media: <MediaView />,
		sounds: <SoundsView />,
		text: <TextView />,
		stickers: <StickersView />,
		effects: <EffectsView />,
		captions: <Captions />,
		adjustment: <AdjustmentsView />,
		pronixEditor: <PronixEditorShell />,
	};

	return (
		<div className="panel bg-background border-border flex h-full overflow-hidden rounded-[10px] border">
			<TabBar />
			{/*
			 * Collapsing must free real width, not just narrow the icon rail —
			 * so the whole tool panel (this block) goes `hidden` (display:none,
			 * no reserved width) in lockstep with the rail collapsing, rather
			 * than just shrinking within whatever width the column still has.
			 * Kept mounted (not conditionally rendered away) so the active
			 * view's scroll position, search text, etc. survive a collapse/
			 * expand cycle — see stores/panel-store persistence for the actual
			 * width change (EditorLayout's TOOLS_COLLAPSED_SIZE).
			 */}
			<div
				className={cn(
					// A hard floor on the actual tool-panel content (Legendas'
					// caption blocks, Ajustes, etc.) — the surrounding
					// ResizablePanel's drag handle is percentage-based (see
					// page.tsx's TOOLS_COLLAPSED_SIZE) and can otherwise be
					// dragged down to a width these panels' layouts genuinely
					// can't work in (buttons/labels colliding, not just small
					// text). Below this, the Preview panel gives up space
					// instead. Only applies when expanded — `hidden` above
					// still lets the collapsed icon rail go narrower.
					"min-w-[280px] flex-1 overflow-hidden",
					sidebarCollapsed && "hidden",
				)}
			>
				<Separator orientation="vertical" className="bg-border" />
				<div className="flex-1 overflow-hidden">{viewMap[activeTab]}</div>
			</div>
		</div>
	);
}
