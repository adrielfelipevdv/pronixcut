import type { TranscriptionSegment, CaptionChunk } from "@/transcription/types";
import {
	DEFAULT_WORDS_PER_CAPTION,
	MIN_CAPTION_DURATION_SECONDS,
} from "@/transcription/caption-defaults";

/**
 * `segments` here are word-level (one entry per word — see worker.ts's
 * `return_timestamps: "word"`), each with the model's own real start/end for
 * that word. Grouping every `wordsPerChunk` words and taking the first
 * word's start / last word's end gives each caption its actual timing
 * directly from the model, instead of the previous approach of linearly
 * guessing word positions within a whole-sentence timestamp — which drifted
 * out of sync whenever a sentence contained a pause the model didn't
 * segment on (worse for non-English audio, where Whisper's segment
 * boundaries are already looser than for English).
 */
export function buildCaptionChunks({
	segments,
	wordsPerChunk = DEFAULT_WORDS_PER_CAPTION,
	minDuration = MIN_CAPTION_DURATION_SECONDS,
}: {
	segments: TranscriptionSegment[];
	wordsPerChunk?: number;
	minDuration?: number;
}): CaptionChunk[] {
	const words = segments.filter((word) => word.text.trim() !== "");
	const captions: CaptionChunk[] = [];
	let globalEndTime = 0;

	for (let i = 0; i < words.length; i += wordsPerChunk) {
		const group = words.slice(i, i + wordsPerChunk);
		const text = group.map((word) => word.text.trim()).join(" ");
		const startTime = Math.max(group[0].start, globalEndTime);
		const endTime = Math.max(startTime + minDuration, group[group.length - 1].end);

		captions.push({
			text,
			startTime,
			duration: endTime - startTime,
		});

		globalEndTime = endTime;
	}

	return captions;
}
