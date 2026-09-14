import {
	Input,
	ALL_FORMATS,
	BlobSource,
	CanvasSink,
	type WrappedCanvas,
} from "mediabunny";

// How many decoded frames to keep buffered ahead of the currently displayed
// one. During continuous playback, decoding happens in this buffer instead
// of on the render's critical path, so a render tick that's briefly slower
// than 1/fps (extra tracks, effects, GPU upload) can still be served
// instantly from the buffer instead of falling behind far enough to trigger
// an expensive re-seek of the decoder.
const PREFETCH_DEPTH = 4;

// How far ahead of the last known decoded position we're willing to
// sequentially decode-and-discard frames to catch up, before giving up and
// doing a full seek instead. Sequential decoding is much cheaper than a seek
// (no keyframe search), so it's worth tolerating a real gap here.
const SEQUENTIAL_CATCHUP_WINDOW_SECONDS = 2.0;

interface VideoSinkData {
	input: Input;
	sink: CanvasSink;
	iterator: AsyncGenerator<WrappedCanvas, void, unknown> | null;
	currentFrame: WrappedCanvas | null;
	frameQueue: WrappedCanvas[];
	lastDecodedTime: number;
	prefetching: boolean;
	prefetchPromise: Promise<void> | null;
}

export class VideoCache {
	private sinks = new Map<string, VideoSinkData>();
	private initPromises = new Map<string, Promise<void>>();
	private frameChain = new Map<string, Promise<unknown>>();
	private seekGenerations = new Map<string, number>();

	async getFrameAt({
		mediaId,
		file,
		time,
	}: {
		mediaId: string;
		file: File;
		time: number;
	}): Promise<WrappedCanvas | null> {
		await this.ensureSink({ mediaId, file });

		const sinkData = this.sinks.get(mediaId);
		if (!sinkData) return null;

		const generation = (this.seekGenerations.get(mediaId) ?? 0) + 1;
		this.seekGenerations.set(mediaId, generation);

		const previous = this.frameChain.get(mediaId) ?? Promise.resolve();
		const current = previous.then(() => {
			if (this.seekGenerations.get(mediaId) !== generation) {
				return sinkData.currentFrame ?? null;
			}
			return this.resolveFrame({ sinkData, time });
		});
		this.frameChain.set(
			mediaId,
			current.catch(() => {}),
		);
		return current;
	}

	private async resolveFrame({
		sinkData,
		time,
	}: {
		sinkData: VideoSinkData;
		time: number;
	}): Promise<WrappedCanvas | null> {
		// Fast path: the frame we're already showing still covers this time.
		if (
			sinkData.currentFrame &&
			this.isFrameValid({ frame: sinkData.currentFrame, time })
		) {
			this.topUpPrefetch({ sinkData });
			return sinkData.currentFrame;
		}

		// Next-fastest path: advance through the already-decoded lookahead
		// buffer. This is the common case during smooth continuous playback —
		// no decoding happens on this call at all.
		const buffered = this.consumeFromQueue({ sinkData, time });
		if (buffered) {
			this.topUpPrefetch({ sinkData });
			return buffered;
		}

		// Moderate path: we're behind, but close enough to the last decoded
		// position that decoding forward sequentially is cheaper than a seek.
		if (
			sinkData.iterator &&
			sinkData.lastDecodedTime >= 0 &&
			time >= sinkData.lastDecodedTime &&
			time < sinkData.lastDecodedTime + SEQUENTIAL_CATCHUP_WINDOW_SECONDS
		) {
			const frame = await this.iterateToTime({ sinkData, targetTime: time });
			if (frame) {
				this.topUpPrefetch({ sinkData });
				return frame;
			}
		}

		// Slow path: a real seek (scrub, jump, or falling too far behind).
		const frame = await this.seekToTime({ sinkData, time });
		if (frame) {
			this.topUpPrefetch({ sinkData });
		}
		return frame;
	}

	/** Advances currentFrame through the buffered queue to cover `time`, without decoding. */
	private consumeFromQueue({
		sinkData,
		time,
	}: {
		sinkData: VideoSinkData;
		time: number;
	}): WrappedCanvas | null {
		let match: WrappedCanvas | null = null;
		while (sinkData.frameQueue.length > 0) {
			const candidate = sinkData.frameQueue[0];
			if (time < candidate.timestamp) break;

			sinkData.frameQueue.shift();
			sinkData.currentFrame = candidate;

			if (this.isFrameValid({ frame: candidate, time })) {
				match = candidate;
				break;
			}
			// Otherwise `candidate` is already stale relative to `time` (we've
			// moved past it); keep advancing through the queue.
		}
		return match;
	}

	private isFrameValid({
		frame,
		time,
	}: {
		frame: WrappedCanvas;
		time: number;
	}): boolean {
		return time >= frame.timestamp && time < frame.timestamp + frame.duration;
	}

	private async iterateToTime({
		sinkData,
		targetTime,
	}: {
		sinkData: VideoSinkData;
		targetTime: number;
	}): Promise<WrappedCanvas | null> {
		if (!sinkData.iterator) return null;

		try {
			while (true) {
				if (sinkData.prefetching && sinkData.prefetchPromise) {
					await sinkData.prefetchPromise;
					const buffered = this.consumeFromQueue({
						sinkData,
						time: targetTime,
					});
					if (buffered) return buffered;
				}

				const { value: frame, done } = await sinkData.iterator.next();
				if (done || !frame) break;

				sinkData.currentFrame = frame;
				sinkData.lastDecodedTime = frame.timestamp;

				if (this.isFrameValid({ frame, time: targetTime })) {
					return frame;
				}

				if (frame.timestamp > targetTime + 1.0) break;
			}
		} catch (error) {
			console.warn("Iterator failed, will restart:", error);
			sinkData.iterator = null;
		}

		return null;
	}

	private async seekToTime({
		sinkData,
		time,
	}: {
		sinkData: VideoSinkData;
		time: number;
	}): Promise<WrappedCanvas | null> {
		try {
			if (sinkData.prefetching && sinkData.prefetchPromise) {
				await sinkData.prefetchPromise;
			}

			if (sinkData.iterator) {
				await sinkData.iterator.return();
				sinkData.iterator = null;
			}

			sinkData.frameQueue = [];
			sinkData.iterator = sinkData.sink.canvases(time);
			sinkData.lastDecodedTime = time;

			const { value: frame } = await sinkData.iterator.next();

			if (frame) {
				sinkData.currentFrame = frame;
				sinkData.lastDecodedTime = frame.timestamp;
				return frame;
			}
		} catch (error) {
			console.warn("Failed to seek video:", error);
		}

		return null;
	}

	/** Keeps decoding ahead in the background until the queue reaches PREFETCH_DEPTH. */
	private topUpPrefetch({ sinkData }: { sinkData: VideoSinkData }): void {
		if (
			sinkData.prefetching ||
			!sinkData.iterator ||
			sinkData.frameQueue.length >= PREFETCH_DEPTH
		) {
			return;
		}

		sinkData.prefetching = true;
		sinkData.prefetchPromise = this.prefetchLoop({ sinkData });
	}

	private async prefetchLoop({
		sinkData,
	}: {
		sinkData: VideoSinkData;
	}): Promise<void> {
		try {
			while (
				sinkData.iterator &&
				sinkData.frameQueue.length < PREFETCH_DEPTH
			) {
				const { value: frame, done } = await sinkData.iterator.next();
				if (done || !frame) {
					sinkData.iterator = null;
					break;
				}
				sinkData.frameQueue.push(frame);
				sinkData.lastDecodedTime = frame.timestamp;
			}
		} catch (error) {
			console.warn("Prefetch failed:", error);
			sinkData.iterator = null;
		} finally {
			sinkData.prefetching = false;
			sinkData.prefetchPromise = null;
		}
	}

	private async ensureSink({
		mediaId,
		file,
	}: {
		mediaId: string;
		file: File;
	}): Promise<void> {
		if (this.sinks.has(mediaId)) return;

		if (this.initPromises.has(mediaId)) {
			await this.initPromises.get(mediaId);
			return;
		}

		const initPromise = this.initializeSink({ mediaId, file });
		this.initPromises.set(mediaId, initPromise);

		try {
			await initPromise;
		} finally {
			this.initPromises.delete(mediaId);
		}
	}
	private async initializeSink({
		mediaId,
		file,
	}: {
		mediaId: string;
		file: File;
	}): Promise<void> {
		const input = new Input({
			source: new BlobSource(file),
			formats: ALL_FORMATS,
		});

		try {
			const videoTrack = await input.getPrimaryVideoTrack();
			if (!videoTrack) {
				throw new Error("No video track found");
			}

			const canDecode = await videoTrack.canDecode();
			if (!canDecode) {
				throw new Error("Video codec not supported for decoding");
			}

			const sink = new CanvasSink(videoTrack, {
				poolSize: PREFETCH_DEPTH + 2,
				fit: "contain",
			});

			this.sinks.set(mediaId, {
				input,
				sink,
				iterator: null,
				currentFrame: null,
				frameQueue: [],
				lastDecodedTime: -1,
				prefetching: false,
				prefetchPromise: null,
			});
		} catch (error) {
			input.dispose();
			console.error(`Failed to initialize video sink for ${mediaId}:`, error);
			throw error;
		}
	}

	clearVideo({ mediaId }: { mediaId: string }): void {
		const sinkData = this.sinks.get(mediaId);
		if (sinkData) {
			if (sinkData.iterator) {
				void sinkData.iterator.return();
			}

			sinkData.input.dispose();
			this.sinks.delete(mediaId);
		}

		this.initPromises.delete(mediaId);
		this.frameChain.delete(mediaId);
		this.seekGenerations.delete(mediaId);
	}

	clearAll(): void {
		for (const [mediaId] of this.sinks) {
			this.clearVideo({ mediaId });
		}
	}

	getStats() {
		return {
			totalSinks: this.sinks.size,
			activeSinks: Array.from(this.sinks.values()).filter((s) => s.iterator)
				.length,
			cachedFrames: Array.from(this.sinks.values()).filter(
				(s) => s.currentFrame,
			).length,
		};
	}
}

export const videoCache = new VideoCache();
