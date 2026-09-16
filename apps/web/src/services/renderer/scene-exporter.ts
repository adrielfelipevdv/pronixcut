import EventEmitter from "eventemitter3";

import {
	Output,
	Mp4OutputFormat,
	MovOutputFormat,
	WebMOutputFormat,
	BufferTarget,
	CanvasSource,
	AudioBufferSource,
	type VideoCodec,
	type AudioCodec,
} from "mediabunny";
import type { FrameRate } from "opencut-wasm";
import { mediaTimeToSeconds } from "opencut-wasm";
import { TICKS_PER_SECOND } from "@/wasm";
import { frameRateToFloat } from "@/fps/utils";
import type { RootNode } from "./nodes/root-node";
import type { BitrateMode, ExportContainer, HardwareAccelPreference } from "@/export";
import { CanvasRenderer } from "./canvas-renderer";

type ExportParams = {
	width: number;
	height: number;
	fps: FrameRate;
	container: ExportContainer;
	videoCodec: VideoCodec;
	videoBitrate: number;
	bitrateMode: BitrateMode;
	hardwareAcceleration: HardwareAccelPreference;
	shouldIncludeAudio?: boolean;
	audioBuffer?: AudioBuffer;
	audioCodec: AudioCodec;
	audioBitrate: number;
};

export type SceneExporterEvents = {
	progress: [progress: number];
	complete: [buffer: ArrayBuffer];
	error: [error: Error];
	cancelled: [];
};

function buildOutputFormat(container: ExportContainer) {
	switch (container) {
		case "webm":
			return new WebMOutputFormat();
		case "mov":
			return new MovOutputFormat();
		default:
			return new Mp4OutputFormat();
	}
}

export class SceneExporter extends EventEmitter<SceneExporterEvents> {
	private renderer: CanvasRenderer;
	private container: ExportContainer;
	private videoCodec: VideoCodec;
	private videoBitrate: number;
	private bitrateMode: BitrateMode;
	private hardwareAcceleration: HardwareAccelPreference;
	private shouldIncludeAudio: boolean;
	private audioBuffer?: AudioBuffer;
	private audioCodec: AudioCodec;
	private audioBitrate: number;

	private isCancelled = false;

	constructor({
		width,
		height,
		fps,
		container,
		videoCodec,
		videoBitrate,
		bitrateMode,
		hardwareAcceleration,
		shouldIncludeAudio,
		audioBuffer,
		audioCodec,
		audioBitrate,
	}: ExportParams) {
		super();
		this.renderer = new CanvasRenderer({ width, height, fps });

		this.container = container;
		this.videoCodec = videoCodec;
		this.videoBitrate = videoBitrate;
		this.bitrateMode = bitrateMode;
		this.hardwareAcceleration = hardwareAcceleration;
		this.shouldIncludeAudio = shouldIncludeAudio ?? false;
		this.audioBuffer = audioBuffer;
		this.audioCodec = audioCodec;
		this.audioBitrate = audioBitrate;
	}

	cancel(): void {
		this.isCancelled = true;
	}

	async export({
		rootNode,
	}: {
		rootNode: RootNode;
	}): Promise<ArrayBuffer | null> {
		const fps = this.renderer.fps;
		const fpsFloat = frameRateToFloat(fps);
		const ticksPerFrame = Math.round(
			(TICKS_PER_SECOND * fps.denominator) / fps.numerator,
		);
		const frameCount = Math.floor(rootNode.duration / ticksPerFrame);

		const output = new Output({
			format: buildOutputFormat(this.container),
			target: new BufferTarget(),
		});

		const videoSource = new CanvasSource(this.renderer.getOutputCanvas(), {
			codec: this.videoCodec,
			bitrate: this.videoBitrate,
			bitrateMode: this.bitrateMode,
			hardwareAcceleration: this.hardwareAcceleration,
		});

		output.addVideoTrack(videoSource, { frameRate: fpsFloat });

		let audioSource: AudioBufferSource | null = null;
		if (this.shouldIncludeAudio && this.audioBuffer) {
			audioSource = new AudioBufferSource({
				codec: this.audioCodec,
				bitrate: this.audioBitrate,
			});
			output.addAudioTrack(audioSource);
		}

		await output.start();

		if (audioSource && this.audioBuffer) {
			await audioSource.add(this.audioBuffer);
			audioSource.close();
		}

		for (let i = 0; i < frameCount; i++) {
			if (this.isCancelled) {
				await output.cancel();
				this.emit("cancelled");
				return null;
			}

			const timeTicks = i * ticksPerFrame;
			const timeSeconds = mediaTimeToSeconds({ time: timeTicks });
			await this.renderer.render({ node: rootNode, time: timeTicks });
			await videoSource.add(timeSeconds, 1 / fpsFloat);

			this.emit("progress", i / frameCount);
		}

		if (this.isCancelled) {
			await output.cancel();
			this.emit("cancelled");
			return null;
		}

		videoSource.close();
		await output.finalize();
		this.emit("progress", 1);

		const buffer = output.target.buffer;
		if (!buffer) {
			this.emit("error", new Error("Failed to export video"));
			return null;
		}

		this.emit("complete", buffer);
		return buffer;
	}
}
