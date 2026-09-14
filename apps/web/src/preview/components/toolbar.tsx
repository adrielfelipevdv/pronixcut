"use client";

import { useState, useEffect } from "react";
import { useEditor } from "@/editor/use-editor";
import { formatTimecode } from "opencut-wasm";
import { invokeAction } from "@/actions";
import { EditableTimecode } from "@/components/editable-timecode";
import { Button } from "@/components/ui/button";
import {
	FullScreenIcon,
	Maximize02Icon,
	Minimize02Icon,
	NextIcon,
	PauseIcon,
	PlayIcon,
	PreviousIcon,
	LayoutRightIcon,
} from "@hugeicons/core-free-icons";
import { HugeiconsIcon } from "@hugeicons/react";
import { Separator } from "@/components/ui/separator";
import {
	Select,
	SelectTrigger,
	SelectContent,
	SelectItem,
	SelectSeparator,
} from "@/components/ui/select";
import { PREVIEW_ZOOM_PRESETS } from "@/preview/zoom";
import { usePreviewViewport } from "./preview-viewport";
import { GridPopover } from "./guide-popover";
import { usePreviewStore } from "@/preview/preview-store";
import { useExpandedPreviewStore } from "@/editor/expanded-preview-store";
import { useSidePreviewStore } from "@/preview/side-preview-store";
import { ProjectSettingsPopover } from "./project-settings-popover";
import type { MediaTime } from "@/wasm";

export function PreviewToolbar({
	onToggleFullscreen,
}: {
	onToggleFullscreen: () => void;
}) {
	return (
		<div className="grid grid-cols-[1fr_auto_1fr] items-center pb-3 pt-5 px-5">
			<TimecodeDisplay />
			<PlayPauseButton />
			<div className="justify-self-end flex items-center gap-2.5">
				<ZoomSelect />
				<Separator orientation="vertical" className="h-4" />
				{/* v0.4.0 */}
				{/* <GridPopover>
					<Button
						variant={activeGuideDefinition ? "secondary" : "text"}
						size="icon"
					>
						{activeGuideDefinition ? (
							activeGuideDefinition.renderTriggerIcon()
						) : (
							<HugeiconsIcon icon={GridTableIcon} />
						)}
					</Button>
				</GridPopover> */}
				<SidePreviewToggleButton />
				<ExpandPreviewButton />
				<Button variant="text" onClick={onToggleFullscreen}>
					<HugeiconsIcon icon={FullScreenIcon} />
				</Button>
				<ProjectSettingsPopover />
			</div>
		</div>
	);
}

function SidePreviewToggleButton() {
	const canvasSize = useEditor((e) => e.project.getActive()?.settings.canvasSize);
	const isEnabled = useSidePreviewStore((s) => s.isEnabled);
	const toggle = useSidePreviewStore((s) => s.toggle);

	// Same gate as ExpandPreviewButton — a horizontal project is already
	// widescreen, so a "show it in 16:9 too" toggle would have nothing to add.
	const isVertical = !!canvasSize && canvasSize.height > canvasSize.width;
	if (!isVertical) return null;

	return (
		<Button
			variant={isEnabled ? "secondary" : "text"}
			onClick={toggle}
			title={isEnabled ? "Ocultar prévia 16:9" : "Mostrar prévia 16:9 ao lado"}
		>
			<HugeiconsIcon icon={LayoutRightIcon} />
		</Button>
	);
}

function ExpandPreviewButton() {
	const canvasSize = useEditor((e) => e.project.getActive()?.settings.canvasSize);
	const isExpanded = useExpandedPreviewStore((s) => s.isExpanded);
	const toggle = useExpandedPreviewStore((s) => s.toggle);

	// Mainly relevant for vertical (9:16) projects — a horizontal video
	// already fills the available width, so the toggle stays hidden there to
	// avoid a control with no real effect.
	const isVertical = !!canvasSize && canvasSize.height > canvasSize.width;
	if (!isVertical) return null;

	return (
		<Button
			variant={isExpanded ? "secondary" : "text"}
			onClick={toggle}
			title={isExpanded ? "Restaurar layout" : "Expandir prévia"}
		>
			<HugeiconsIcon icon={isExpanded ? Minimize02Icon : Maximize02Icon} />
		</Button>
	);
}

function TimecodeDisplay() {
	const editor = useEditor();
	const totalDuration = useEditor((e) => e.timeline.getTotalDuration());
	const fps = useEditor((e) => e.project.getActive().settings.fps);
	const [currentTime, setCurrentTime] = useState<MediaTime>(() =>
		editor.playback.getCurrentTime(),
	);

	useEffect(() => {
		const unsubscribeUpdate = editor.playback.onUpdate(setCurrentTime);
		const unsubscribeSeek = editor.playback.onSeek(setCurrentTime);
		return () => {
			unsubscribeUpdate();
			unsubscribeSeek();
		};
	}, [editor.playback]);

	return (
		<div className="flex items-center">
			<EditableTimecode
				time={currentTime}
				duration={totalDuration}
				format="HH:MM:SS:FF"
				fps={fps}
				onTimeChange={({ time }) => editor.playback.seek({ time })}
				className="text-center"
			/>
			<span className="text-muted-foreground px-2 font-mono text-xs">/</span>
			<span className="text-muted-foreground font-mono text-xs">
				{formatTimecode({
					time: totalDuration,
					format: "HH:MM:SS:FF",
					rate: fps,
				})}
			</span>
		</div>
	);
}

function ZoomSelect() {
	const { isAtFit, zoomPercent, fitToScreen, setViewportPercent } =
		usePreviewViewport();

	const displayLabel = isAtFit ? "Ajustar" : `${zoomPercent}%`;

	const onValueChange = (value: string) => {
		if (value === "fit") {
			fitToScreen();
		} else {
			setViewportPercent({ percent: Number(value) });
		}
	};

	return (
		<Select
			value={isAtFit ? "fit" : String(zoomPercent)}
			onValueChange={onValueChange}
		>
			<SelectTrigger className="tabular-nums">{displayLabel}</SelectTrigger>
			<SelectContent>
				<SelectItem value="fit">Ajustar</SelectItem>
				<SelectSeparator />
				{PREVIEW_ZOOM_PRESETS.map((preset) => (
					<SelectItem key={preset} value={String(preset)}>
						{preset}%
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function PlayPauseButton() {
	const isPlaying = useEditor((e) => e.playback.getIsPlaying());

	return (
		<div className="flex items-center gap-1">
			<Button
				variant="text"
				size="icon"
				title="Quadro anterior"
				onClick={() => invokeAction("frame-step-backward")}
			>
				<HugeiconsIcon icon={PreviousIcon} className="size-4" />
			</Button>
			<Button
				variant="text"
				size="icon"
				className="bg-accent hover:bg-surface-hover size-9 rounded-full"
				onClick={() => invokeAction("toggle-play")}
			>
				<HugeiconsIcon
					icon={isPlaying ? PauseIcon : PlayIcon}
					className="size-4"
				/>
			</Button>
			<Button
				variant="text"
				size="icon"
				title="Próximo quadro"
				onClick={() => invokeAction("frame-step-forward")}
			>
				<HugeiconsIcon icon={NextIcon} className="size-4" />
			</Button>
		</div>
	);
}
