"use client";

import * as ResizablePrimitive from "react-resizable-panels";

import { cn } from "@/utils/ui";

const ResizablePanelGroup = ({
	className,
	...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelGroup>) => (
	<ResizablePrimitive.PanelGroup
		className={cn(
			"flex size-full data-[panel-group-direction=vertical]:flex-col",
			className,
		)}
		{...props}
	/>
);

const ResizablePanel = ResizablePrimitive.Panel;

const ResizableHandle = ({
	withHandle,
	className,
	...props
}: React.ComponentProps<typeof ResizablePrimitive.PanelResizeHandle> & {
	withHandle?: boolean;
}) => (
	<ResizablePrimitive.PanelResizeHandle
		className={cn(
			"focus-visible:ring-ring group relative flex w-px items-center justify-center bg-transparent after:absolute after:inset-y-0 after:left-1/2 after:w-1 after:-translate-x-1/2 focus-visible:ring-1 focus-visible:ring-offset-1 focus-visible:outline-hidden data-[panel-group-direction=vertical]:h-px data-[panel-group-direction=vertical]:w-full data-[panel-group-direction=vertical]:after:left-0 data-[panel-group-direction=vertical]:after:h-1 data-[panel-group-direction=vertical]:after:w-full data-[panel-group-direction=vertical]:after:translate-x-0 data-[panel-group-direction=vertical]:after:-translate-y-1/2 [&[data-panel-group-direction=vertical]>div]:rotate-90",
			className,
		)}
		{...props}
	>
		<span
			className="bg-pronix-yellow pointer-events-none absolute inset-y-0 left-1/2 w-[2px] -translate-x-1/2 scale-y-0 rounded-full opacity-0 transition-[opacity,transform] duration-150 group-hover:scale-y-100 group-hover:opacity-40 group-data-[resize-handle-state=drag]:scale-y-100 group-data-[resize-handle-state=drag]:opacity-80 group-data-[panel-group-direction=vertical]:inset-x-0 group-data-[panel-group-direction=vertical]:top-1/2 group-data-[panel-group-direction=vertical]:left-0 group-data-[panel-group-direction=vertical]:h-[2px] group-data-[panel-group-direction=vertical]:w-full group-data-[panel-group-direction=vertical]:-translate-y-1/2 group-data-[panel-group-direction=vertical]:translate-x-0 group-data-[panel-group-direction=vertical]:scale-x-0 group-data-[panel-group-direction=vertical]:group-hover:scale-x-100 group-data-[panel-group-direction=vertical]:group-data-[resize-handle-state=drag]:scale-x-100"
		/>
	</ResizablePrimitive.PanelResizeHandle>
);

export { ResizablePanelGroup, ResizablePanel, ResizableHandle };
