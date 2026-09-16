import type { TextWordTiming } from "@/timeline/types";

/**
 * Structured (not random) fallback word-timing split for a caption block
 * that has no real per-word ASR timestamps: each word gets a share of the
 * block's duration proportional to its own character length (a longer word
 * reads for longer), in reading order. Architecture stays ready for real
 * timestamps: whenever a transcription pipeline starts producing word-level
 * timing, it can populate `TextElement.words` directly and this function is
 * simply never called for that block.
 */
export function synthesizeWordTimings({
	text,
	duration,
}: {
	text: string;
	duration: number;
}): TextWordTiming[] {
	const words = text.trim().split(/\s+/).filter((word) => word.length > 0);
	if (words.length === 0 || duration <= 0) {
		return [];
	}

	const weights = words.map((word) => Math.max(1, word.length));
	const totalWeight = weights.reduce((sum, w) => sum + w, 0);

	const timings: TextWordTiming[] = [];
	let cursor = 0;
	for (let i = 0; i < words.length; i++) {
		const word = words[i];
		const weight = weights[i];
		if (word === undefined || weight === undefined) continue;
		const span = (weight / totalWeight) * duration;
		const start = cursor;
		const end = i === words.length - 1 ? duration : cursor + span;
		timings.push({ text: word, start, end });
		cursor = end;
	}
	return timings;
}
