import { Command, type CommandResult } from "@/commands/base-command";
import { SplitElementsCommand, DeleteElementsCommand } from "@/commands";
import { EditorCore } from "@/core";
import { applyRippleAdjustments } from "@/ripple";
import type { SceneTracks, TimelineTrack, ElementRef } from "@/timeline/types";
import { decodeAudioToFloat32 } from "@/media/audio";
import type { MediaAsset } from "@/media/types";
import { addMediaTime, mediaTimeFromSeconds, subMediaTime, type MediaTime } from "@/wasm";
import { detectSilenceRanges } from "./silence-detection";

export interface SilenceCutOptions {
	thresholdDb: number;
	minSilenceSeconds: number;
	paddingSeconds: number;
}

export interface SilenceCutRangeTicks {
	start: MediaTime;
	end: MediaTime;
}

/**
 * Analyzes the source audio of `mediaAsset` (the clip's own file, not a
 * timeline-wide mixdown — matching the original PronixEditor's per-clip
 * "Auto-Edit" behavior) and returns the silence ranges expressed in
 * TIMELINE time (already mapped through the target element's startTime/
 * trimStart and clipped to its visible window), ready to feed into
 * `SilenceCutCommand`.
 */
export async function detectSilenceForElement({
	mediaAsset,
	element,
	options,
}: {
	mediaAsset: MediaAsset;
	element: { startTime: MediaTime; duration: MediaTime; trimStart: MediaTime };
	options: SilenceCutOptions;
}): Promise<SilenceCutRangeTicks[]> {
	const { samples, sampleRate } = await decodeAudioToFloat32({
		audioBlob: mediaAsset.file,
	});

	const rangesInSourceSeconds = detectSilenceRanges({
		samples,
		sampleRate,
		thresholdDb: options.thresholdDb,
		minSilenceSeconds: options.minSilenceSeconds,
		paddingSeconds: options.paddingSeconds,
	});

	const elementEnd = addMediaTime({ a: element.startTime, b: element.duration });

	const timelineRanges: SilenceCutRangeTicks[] = [];
	for (const range of rangesInSourceSeconds) {
		const sourceStartTicks = mediaTimeFromSeconds({ seconds: range.start });
		const sourceEndTicks = mediaTimeFromSeconds({ seconds: range.end });

		const timelineStart = addMediaTime({
			a: element.startTime,
			b: subMediaTime({ a: sourceStartTicks, b: element.trimStart }),
		});
		const timelineEnd = addMediaTime({
			a: element.startTime,
			b: subMediaTime({ a: sourceEndTicks, b: element.trimStart }),
		});

		const clippedStart = timelineStart < element.startTime ? element.startTime : timelineStart;
		const clippedEnd = timelineEnd > elementEnd ? elementEnd : timelineEnd;

		if (clippedEnd > clippedStart) {
			timelineRanges.push({ start: clippedStart, end: clippedEnd });
		}
	}

	return timelineRanges;
}

function findOverlappingElements({
	tracks,
	time,
}: {
	tracks: TimelineTrack[];
	time: MediaTime;
}): ElementRef[] {
	const refs: ElementRef[] = [];
	for (const track of tracks) {
		for (const element of track.elements) {
			const start = element.startTime;
			const end = addMediaTime({ a: element.startTime, b: element.duration });
			if (time >= start && time < end) {
				refs.push({ trackId: track.id, elementId: element.id });
				break;
			}
		}
	}
	return refs;
}

/**
 * Removes each given time range from the timeline and ripples everything
 * after it to close the gap — a real cut, not a silent/blank hole.
 *
 * Scope: operates on the main video track and audio tracks only (matching
 * "cut the silent parts of the program"). Overlay tracks (text, stickers,
 * graphics) are not shifted by this command — if a caption/overlay element
 * happens to span a cut range, it will end up misaligned and needs manual
 * adjustment. This mirrors a real, documented limitation rather than
 * attempting a whole-timeline ripple that this codebase's ripple system
 * (per-track diff based) isn't designed to do generically.
 */
export class SilenceCutCommand extends Command {
	private savedState: SceneTracks | null = null;
	private cutCount = 0;

	constructor(private readonly ranges: SilenceCutRangeTicks[]) {
		super();
	}

	getCutCount(): number {
		return this.cutCount;
	}

	execute(): CommandResult | undefined {
		const editor = EditorCore.getInstance();
		this.savedState = editor.scenes.getActiveScene().tracks;
		this.cutCount = 0;

		const sortedRanges = [...this.ranges].sort((a, b) => b.start - a.start);
		for (const range of sortedRanges) {
			this.cutOneRange({ editor, range });
		}

		return {
			selection: {
				selectedElements: [],
				selectedKeyframes: [],
				keyframeSelectionAnchor: null,
				selectedMaskPoints: null,
			},
		};
	}

	private cutOneRange({
		editor,
		range,
	}: {
		editor: EditorCore;
		range: SilenceCutRangeTicks;
	}): void {
		const tracks = editor.scenes.getActiveScene().tracks;
		const targetTracks: TimelineTrack[] = [tracks.main, ...tracks.audio];

		const elementsAtStart = findOverlappingElements({
			tracks: targetTracks,
			time: range.start,
		});
		if (elementsAtStart.length === 0) return;

		const splitStart = new SplitElementsCommand({
			elements: elementsAtStart,
			splitTime: range.start,
		});
		splitStart.execute();
		const rightIds = splitStart.getRightSideElements();
		if (rightIds.length === 0) return;

		const splitEnd = new SplitElementsCommand({
			elements: rightIds,
			splitTime: range.end,
		});
		splitEnd.execute();

		// After splitEnd, the elements under `rightIds` are exactly the
		// [range.start, range.end) middle pieces (a split keeps the left
		// half under its original id).
		new DeleteElementsCommand({ elements: rightIds }).execute();
		this.cutCount += 1;

		const shiftAmount = subMediaTime({ a: range.end, b: range.start });
		const afterTracks = editor.scenes.getActiveScene().tracks;
		const rippled = applyRippleAdjustments({
			tracks: afterTracks,
			adjustments: targetTracks.map((track) => ({
				trackId: track.id,
				afterTime: range.end,
				shiftAmount,
			})),
		});
		editor.timeline.updateTracks(rippled);
	}

	undo(): void {
		if (this.savedState) {
			EditorCore.getInstance().timeline.updateTracks(this.savedState);
		}
	}
}
