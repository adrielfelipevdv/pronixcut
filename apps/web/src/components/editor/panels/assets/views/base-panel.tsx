import { cn } from "@/utils/ui";

interface PanelViewProps extends React.HTMLAttributes<HTMLDivElement> {
	title?: string;
	actions?: React.ReactNode;
	children: React.ReactNode;
	contentClassName?: string;
	scrollClassName?: string;
	hideHeader?: boolean;
	ref?: React.Ref<HTMLDivElement>;
	onScroll?: React.UIEventHandler<HTMLDivElement>;
	scrollRef?: React.Ref<HTMLDivElement>;
}

export function PanelView({
	title,
	actions,
	children,
	className,
	contentClassName,
	scrollClassName,
	hideHeader = false,
	ref,
	onScroll,
	scrollRef,
	...rest
}: PanelViewProps) {
	return (
		<div
			className={cn("relative flex h-full flex-col", className)}
			ref={ref}
			{...rest}
		>
			{!hideHeader && (
				<div className="bg-background border-border flex h-11 shrink-0 items-center justify-between gap-2 border-b pr-2 pl-3">
					{title && (
						<span className="text-foreground min-w-0 flex-1 truncate text-[15px] font-semibold">
							{title}
						</span>
					)}
					{/* Actions (Importar, diagnostic buttons, etc.) must never get
					    clipped by a long title at a narrow panel width — the title
					    truncates first (see its `truncate` above), not this. */}
					{actions && <div className="flex shrink-0 items-center">{actions}</div>}
				</div>
			)}
			<div
				className={cn(
					"scrollbar-hidden size-full overflow-y-auto",
					hideHeader ? "pt-4" : "pt-2",
					scrollClassName,
				)}
				ref={scrollRef}
				onScroll={onScroll}
			>
				<div className={cn("w-full flex-1 px-2 pt-0", contentClassName)}>
					{children}
				</div>
			</div>
		</div>
	);
}
