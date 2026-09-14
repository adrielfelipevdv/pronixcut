import type { TrackType } from "@/timeline";

// Pronix timeline color hierarchy: yellow stays reserved for
// action/selection/brand (see the selection ring in this file's consumer);
// blue marks text/caption clips, green marks audio, so a glance at the
// timeline tells you what kind of track you're looking at without reading
// labels.
export const TIMELINE_AUDIO_WAVEFORM_COLOR = "#20D98B";

export const TIMELINE_TRACK_THEME: Record<
	TrackType,
	{
		elementClassName: string;
		waveformColor?: string;
	}
> = {
	video: { elementClassName: "transparent" },
	text: { elementClassName: "bg-[#3B65D6]" },
	audio: {
		elementClassName: "bg-[#1B7A54]",
		waveformColor: TIMELINE_AUDIO_WAVEFORM_COLOR,
	},
	graphic: { elementClassName: "bg-[#BA5D7A]" },
	effect: { elementClassName: "bg-[#5d93ba]" },
} as const;

export const SELECTED_TRACK_ROW_CLASS = "bg-accent/50";
export const DEFAULT_TIMELINE_BOOKMARK_COLOR = "#009dff";

export function getTimelineElementClassName({
	type,
}: {
	type: TrackType;
}): string {
	return TIMELINE_TRACK_THEME[type].elementClassName.trim();
}
