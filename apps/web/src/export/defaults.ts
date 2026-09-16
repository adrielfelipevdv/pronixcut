import type { ExportContainer, ExportOptions } from "./index";

export const DEFAULT_CONTAINER: ExportContainer = "mp4";

const DEFAULT_VIDEO_CODEC: Record<ExportContainer, ExportOptions["codec"]> = {
	mp4: "avc",
	webm: "vp9",
	mov: "avc",
};

const DEFAULT_AUDIO_CODEC: Record<ExportContainer, ExportOptions["audio"]["codec"]> = {
	mp4: "aac",
	webm: "opus",
	mov: "aac",
};

export function buildDefaultExportOptions({
	filename,
	container = DEFAULT_CONTAINER,
}: {
	filename: string;
	container?: ExportContainer;
}): ExportOptions {
	return {
		filename,
		container,
		codec: DEFAULT_VIDEO_CODEC[container],
		resolution: { preset: "project", lockAspectRatio: true },
		frameRateId: "project",
		quality: "high",
		videoBitrate: 0,
		bitrateMode: "variable",
		hardwareAcceleration: "no-preference",
		audio: {
			include: true,
			codec: DEFAULT_AUDIO_CODEC[container],
			bitrate: 192_000,
			sampleRate: 48_000,
			channels: 2,
		},
	};
}
