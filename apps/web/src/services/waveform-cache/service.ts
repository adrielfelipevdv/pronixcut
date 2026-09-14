"use client";

import { createAudioContext, decodeAudioTrackFromFile } from "@/media/audio";
import {
	buildSourceWaveformSummary,
	type SourceWaveformSummary,
} from "@/media/waveform-summary";

interface GetSourceWaveformSummaryArgs {
	sourceKey: string;
	audioBuffer?: AudioBuffer;
	sourceFile?: File;
	sourceFileIsVideo?: boolean;
	audioUrl?: string;
}

export class WaveformCache {
	private summaries = new Map<string, Promise<SourceWaveformSummary>>();

	getSourceSummary({
		sourceKey,
		audioBuffer,
		sourceFile,
		sourceFileIsVideo,
		audioUrl,
	}: GetSourceWaveformSummaryArgs): Promise<SourceWaveformSummary> {
		const existing = this.summaries.get(sourceKey);
		if (existing) {
			return existing;
		}

		const promise = this.buildSummary({
			sourceKey,
			audioBuffer,
			sourceFile,
			sourceFileIsVideo,
			audioUrl,
		}).catch((error) => {
			this.summaries.delete(sourceKey);
			throw error;
		});

		this.summaries.set(sourceKey, promise);
		return promise;
	}

	clearSource({ sourceKey }: { sourceKey: string }): void {
		this.summaries.delete(sourceKey);
	}

	clearAll(): void {
		this.summaries.clear();
	}

	private async buildSummary({
		sourceKey,
		audioBuffer,
		sourceFile,
		sourceFileIsVideo,
		audioUrl,
	}: GetSourceWaveformSummaryArgs): Promise<SourceWaveformSummary> {
		if (audioBuffer) {
			return buildSourceWaveformSummary({ sourceKey, buffer: audioBuffer });
		}

		if (sourceFile) {
			// A separated-audio clip still points at the original media file,
			// which for a video source is a muxed container. Native
			// decodeAudioData can't pull audio out of that reliably (it silently
			// fails, and — since a failed lookup is evicted from the cache —
			// every remount retried the same expensive full-file read forever).
			// Demux the audio track directly via mediabunny for video files, and
			// keep the native decoder for plain audio files.
			if (sourceFileIsVideo || sourceFile.type.startsWith("video/")) {
				const buffer = await decodeAudioTrackFromFile({ file: sourceFile });
				if (!buffer) {
					throw new Error(`No audio track found in ${sourceKey}`);
				}
				return buildSourceWaveformSummary({ sourceKey, buffer });
			}

			const arrayBuffer = await sourceFile.arrayBuffer();
			const audioContext = createAudioContext();
			try {
				const buffer = await audioContext.decodeAudioData(
					arrayBuffer.slice(0),
				);
				return buildSourceWaveformSummary({ sourceKey, buffer });
			} catch (error) {
				const fallbackBuffer = await decodeAudioTrackFromFile({
					file: sourceFile,
				});
				if (!fallbackBuffer) throw error;
				return buildSourceWaveformSummary({
					sourceKey,
					buffer: fallbackBuffer,
				});
			} finally {
				void audioContext.close();
			}
		}

		if (audioUrl) {
			const response = await fetch(audioUrl);
			if (!response.ok) {
				throw new Error(`Failed to fetch waveform source: ${response.status}`);
			}
			const arrayBuffer = await response.arrayBuffer();
			const audioContext = createAudioContext();
			try {
				const buffer = await audioContext.decodeAudioData(
					arrayBuffer.slice(0),
				);
				return buildSourceWaveformSummary({ sourceKey, buffer });
			} finally {
				void audioContext.close();
			}
		}

		throw new Error(`No waveform source available for ${sourceKey}`);
	}
}

export const waveformCache = new WaveformCache();
