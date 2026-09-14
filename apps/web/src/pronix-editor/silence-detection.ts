/**
 * RMS-based silence detection, ported from the concept used by the original
 * PronixEditor's `editing/audio_silence.py` (silence_db threshold + pre/post
 * padding), but re-implemented here directly over Web Audio decoded samples
 * instead of shelling out to ffmpeg — this app already decodes audio
 * client-side for transcription (see src/media/audio.ts), so the same
 * Float32Array pipeline is reused instead of adding a new dependency.
 */

const WINDOW_SECONDS = 0.02; // 20ms analysis window

export interface SilenceRangeSeconds {
	start: number;
	end: number;
}

function computeWindowDb({
	samples,
	from,
	to,
}: {
	samples: Float32Array;
	from: number;
	to: number;
}): number {
	let sumSquares = 0;
	const count = to - from;
	if (count <= 0) return -100;

	for (let i = from; i < to; i++) {
		sumSquares += samples[i] * samples[i];
	}

	const rms = Math.sqrt(sumSquares / count);
	if (rms <= 0) return -100;

	return 20 * Math.log10(rms);
}

/**
 * Detects contiguous silent regions in `samples`, then shrinks each region
 * by `paddingSeconds` on both ends so a bit of natural silence is kept
 * around speech (avoids abrupt cuts right up against a word).
 */
export function detectSilenceRanges({
	samples,
	sampleRate,
	thresholdDb,
	minSilenceSeconds,
	paddingSeconds,
}: {
	samples: Float32Array;
	sampleRate: number;
	thresholdDb: number;
	minSilenceSeconds: number;
	paddingSeconds: number;
}): SilenceRangeSeconds[] {
	const windowSize = Math.max(1, Math.round(sampleRate * WINDOW_SECONDS));
	const windowCount = Math.ceil(samples.length / windowSize);

	const ranges: SilenceRangeSeconds[] = [];
	let silenceStartWindow: number | null = null;

	for (let w = 0; w < windowCount; w++) {
		const from = w * windowSize;
		const to = Math.min(samples.length, from + windowSize);
		const db = computeWindowDb({ samples, from, to });
		const isSilent = db < thresholdDb;

		if (isSilent && silenceStartWindow === null) {
			silenceStartWindow = w;
		} else if (!isSilent && silenceStartWindow !== null) {
			ranges.push({
				start: (silenceStartWindow * windowSize) / sampleRate,
				end: (w * windowSize) / sampleRate,
			});
			silenceStartWindow = null;
		}
	}

	if (silenceStartWindow !== null) {
		ranges.push({
			start: (silenceStartWindow * windowSize) / sampleRate,
			end: samples.length / sampleRate,
		});
	}

	return ranges
		.filter((range) => range.end - range.start >= minSilenceSeconds)
		.map((range) => ({
			start: range.start + paddingSeconds,
			end: range.end - paddingSeconds,
		}))
		.filter((range) => range.end > range.start);
}
