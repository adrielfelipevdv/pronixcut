"use client";

import { useState } from "react";
import { cn } from "@/utils/ui";
import { AutoEditTab } from "./tabs/auto-edit-tab";
import { VisualAiTab } from "./tabs/visual-ai-tab";
import { AssetBrowserTab } from "./tabs/asset-browser-tab";
import { SmartAnimationTab } from "./tabs/smart-animation-tab";
import { BRollAiTab } from "./tabs/broll-ai-tab";
import { IntegrationsTab } from "./tabs/integrations-tab";

// Sub-menu shell mirroring the original PronixEditorPRO plugin's tab bar
// (apps/desktop/src/AppShell.tsx in that project) — same six sections, same
// icons, same "mount once on first visit, then just hide" behavior so
// generation/config state in a tab survives switching away and back,
// exactly like the original.
const SUB_TABS = [
	{
		id: "auto",
		label: "Auto-Edit",
		icon: <path d="M13 2L5.5 13h5L9.8 22 18.5 10h-5L13 2z" />,
	},
	{
		id: "visual",
		label: "IA Visual",
		icon: (
			<>
				<rect x="3" y="5" width="18" height="14" rx="2" />
				<circle cx="9" cy="11" r="2" />
				<path d="M21 17l-5-5-4 4-2-2-4 4" />
			</>
		),
	},
	{
		id: "browser",
		label: "Navegador",
		icon: (
			<>
				<circle cx="12" cy="12" r="9" />
				<path d="M3 12h18M12 3c2.5 2.5 2.5 15 0 18M12 3c-2.5 2.5-2.5 15 0 18" />
			</>
		),
	},
	{
		id: "anim",
		label: "Animação",
		icon: (
			<>
				<path d="M5 3v18l5-4 4 4 5-4V3" />
				<path d="M9 8h6" />
			</>
		),
	},
	{
		id: "broll",
		label: "B-Roll IA",
		icon: (
			<>
				<rect x="2" y="6" width="14" height="12" rx="2" />
				<path d="M16 10l6-3v10l-6-3" />
			</>
		),
	},
	{
		id: "integr",
		label: "Integrações",
		icon: (
			<>
				<circle cx="12" cy="12" r="3" />
				<path d="M19 12a7 7 0 00-.1-1l2-1.5-2-3.4-2.3 1a7 7 0 00-1.7-1l-.3-2.6H10l-.3 2.6a7 7 0 00-1.7 1l-2.3-1-2 3.4L5.6 11a7 7 0 000 2l-2 1.5 2 3.4 2.3-1a7 7 0 001.7 1l.3 2.6h4l.3-2.6a7 7 0 001.7-1l2.3 1 2-3.4-2-1.5a7 7 0 00.1-1z" />
			</>
		),
	},
] as const;

type SubTabId = (typeof SUB_TABS)[number]["id"];

export function PronixEditorShell() {
	const [activeTab, setActiveTab] = useState<SubTabId>("auto");
	const [visited, setVisited] = useState<Set<SubTabId>>(() => new Set(["auto"]));

	const go = (id: SubTabId) => {
		setActiveTab(id);
		setVisited((prev) => (prev.has(id) ? prev : new Set(prev).add(id)));
	};

	return (
		<div className="flex h-full flex-col">
			<div className="border-border flex shrink-0 flex-wrap gap-1 border-b p-1.5">
				{SUB_TABS.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => go(tab.id)}
						className={cn(
							"flex shrink-0 items-center gap-1.5 rounded-md px-2.5 py-1.5 text-xs font-medium transition-colors",
							activeTab === tab.id
								? "bg-secondary text-secondary-foreground"
								: "text-muted-foreground hover:bg-accent",
						)}
					>
						<svg
							viewBox="0 0 24 24"
							fill="none"
							stroke="currentColor"
							strokeWidth="1.6"
							strokeLinecap="round"
							strokeLinejoin="round"
							className="size-3.5 shrink-0"
						>
							{tab.icon}
						</svg>
						{tab.label}
					</button>
				))}
			</div>

			<div className="min-h-0 flex-1 overflow-y-auto">
				{/* Each tab mounts on first visit and stays mounted (display:none when
				    inactive) so in-progress generations/edits aren't lost on switch. */}
				<div hidden={activeTab !== "auto"}>
					<AutoEditTab />
				</div>
				{visited.has("visual") && (
					<div hidden={activeTab !== "visual"}>
						<VisualAiTab />
					</div>
				)}
				{visited.has("browser") && (
					<div hidden={activeTab !== "browser"}>
						<AssetBrowserTab />
					</div>
				)}
				{visited.has("anim") && (
					<div hidden={activeTab !== "anim"}>
						<SmartAnimationTab />
					</div>
				)}
				{visited.has("broll") && (
					<div hidden={activeTab !== "broll"}>
						<BRollAiTab />
					</div>
				)}
				{visited.has("integr") && (
					<div hidden={activeTab !== "integr"}>
						<IntegrationsTab />
					</div>
				)}
			</div>
		</div>
	);
}
