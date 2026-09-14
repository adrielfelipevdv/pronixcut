"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { cn } from "@/utils/ui";
import {
	TAB_KEYS,
	tabs,
	useAssetsPanelStore,
} from "@/components/editor/panels/assets/assets-panel-store";
import {
	Tooltip,
	TooltipContent,
	TooltipProvider,
	TooltipTrigger,
} from "@/components/ui/tooltip";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowLeft01Icon, ArrowRight01Icon } from "@hugeicons/core-free-icons";

export const SIDEBAR_EXPANDED_WIDTH_PX = 188;
export const SIDEBAR_COLLAPSED_WIDTH_PX = 56;

export function TabBar() {
	const { activeTab, setActiveTab } = useAssetsPanelStore();
	const collapsed = useAssetsPanelStore((s) => s.sidebarCollapsed);
	const toggleCollapsed = useAssetsPanelStore((s) => s.toggleSidebarCollapsed);
	const [showTopFade, setShowTopFade] = useState(false);
	const [showBottomFade, setShowBottomFade] = useState(false);
	const scrollRef = useRef<HTMLDivElement>(null);

	const checkScrollPosition = useCallback(() => {
		const element = scrollRef.current;
		if (!element) return;

		const { scrollTop, scrollHeight, clientHeight } = element;
		setShowTopFade(scrollTop > 0);
		setShowBottomFade(scrollTop < scrollHeight - clientHeight - 1);
	}, []);

	useEffect(() => {
		const element = scrollRef.current;
		if (!element) return;

		checkScrollPosition();
		element.addEventListener("scroll", checkScrollPosition);

		const resizeObserver = new ResizeObserver(checkScrollPosition);
		resizeObserver.observe(element);

		return () => {
			element.removeEventListener("scroll", checkScrollPosition);
			resizeObserver.disconnect();
		};
	}, [checkScrollPosition]);

	return (
		<TooltipProvider delayDuration={200}>
			<div
				className="bg-sidebar border-border relative flex shrink-0 flex-col border-r transition-[width] duration-150 ease-out"
				style={{
					width: collapsed
						? SIDEBAR_COLLAPSED_WIDTH_PX
						: SIDEBAR_EXPANDED_WIDTH_PX,
				}}
			>
				<div className="relative min-h-0 flex-1">
					<div
						ref={scrollRef}
						className="scrollbar-hidden relative flex size-full flex-col items-stretch justify-start gap-0.5 overflow-y-auto p-2"
					>
						{TAB_KEYS.map((tabKey) => {
							const tab = tabs[tabKey];
							const active = activeTab === tabKey;
							const button = (
								<button
									key={tabKey}
									type="button"
									aria-label={tab.label}
									onClick={() => setActiveTab(tabKey)}
									className={cn(
										"flex h-10 shrink-0 items-center gap-2.5 rounded-md border-l-2 border-transparent text-left text-[13px] font-medium transition-colors duration-150",
										collapsed ? "justify-center px-0" : "pl-2.5 pr-2",
										active
											? "border-l-primary bg-primary/8 text-primary"
											: "text-muted-foreground hover:bg-accent hover:text-foreground",
									)}
								>
									<tab.icon className="size-5 shrink-0" />
									{!collapsed && <span className="truncate">{tab.label}</span>}
								</button>
							);

							if (!collapsed) return button;

							return (
								<Tooltip key={tabKey}>
									<TooltipTrigger asChild>{button}</TooltipTrigger>
									<TooltipContent side="right">{tab.label}</TooltipContent>
								</Tooltip>
							);
						})}
					</div>

					<FadeOverlay direction="top" show={showTopFade} />
					<FadeOverlay direction="bottom" show={showBottomFade} />
				</div>

				<div className="border-border flex shrink-0 justify-center border-t p-1.5">
					<Tooltip>
						<TooltipTrigger asChild>
							<button
								type="button"
								onClick={toggleCollapsed}
								aria-label={collapsed ? "Expandir menu" : "Recolher menu"}
								className="text-muted-foreground hover:bg-accent hover:text-foreground flex size-8 shrink-0 items-center justify-center rounded-md transition-colors duration-150"
							>
								<HugeiconsIcon
									icon={collapsed ? ArrowRight01Icon : ArrowLeft01Icon}
									className="size-4"
								/>
							</button>
						</TooltipTrigger>
						<TooltipContent side="right">
							{collapsed ? "Expandir menu" : "Recolher menu"}
						</TooltipContent>
					</Tooltip>
				</div>
			</div>
		</TooltipProvider>
	);
}

function FadeOverlay({
	direction,
	show,
}: {
	direction: "top" | "bottom";
	show: boolean;
}) {
	return (
		<div
			className={cn(
				"pointer-events-none absolute right-0 left-0 h-6",
				direction === "top" && show
					? "from-sidebar top-0 bg-linear-to-b to-transparent"
					: "from-sidebar bottom-0 bg-linear-to-t to-transparent",
			)}
		/>
	);
}
