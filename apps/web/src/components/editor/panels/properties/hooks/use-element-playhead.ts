import { useEffect, useState } from "react";
import { useEditor } from "@/editor/use-editor";
import { getElementLocalTime } from "@/animation";
import { addMediaTime, mediaTime, type MediaTime } from "@/wasm";

export function useElementPlayhead({
	startTime,
	duration,
}: {
	startTime: MediaTime;
	duration: MediaTime;
}) {
	const editor = useEditor();
	// A `useEditor` selector only re-renders on play/pause/seek transitions
	// (see PlaybackManager.notify vs. notifyUpdate) — during playback itself
	// that left every animated param shown here (opacity/position/etc.
	// keyframes) frozen at the value from the moment Play was pressed, only
	// snapping to the correct value on pause. Subscribing to onUpdate directly
	// (same pattern as the preview's timecode display) keeps this in sync
	// every frame while playing, scoped to just this small panel.
	const [playheadTime, setPlayheadTime] = useState<MediaTime>(() =>
		editor.playback.getCurrentTime(),
	);

	useEffect(() => {
		const unsubscribeUpdate = editor.playback.onUpdate(setPlayheadTime);
		const unsubscribeSeek = editor.playback.onSeek(setPlayheadTime);
		return () => {
			unsubscribeUpdate();
			unsubscribeSeek();
		};
	}, [editor.playback]);

	const localTime = mediaTime({
		ticks: getElementLocalTime({
			timelineTime: playheadTime,
			elementStartTime: startTime,
			elementDuration: duration,
		}),
	});
	const isPlayheadWithinElementRange =
		playheadTime >= startTime &&
		playheadTime <= addMediaTime({ a: startTime, b: duration });

	return { localTime, isPlayheadWithinElementRange };
}
