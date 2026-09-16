import type { FrameRate } from "opencut-wasm";
import type { AudioCodec, VideoCodec } from "mediabunny";
import { EXPORT_MIME_TYPES } from "./mime-types";
import type { ResolutionPreset, Size } from "./resolution";

export const EXPORT_CONTAINER_VALUES = ["mp4", "webm", "mov"] as const;
export type ExportContainer = (typeof EXPORT_CONTAINER_VALUES)[number];

export const EXPORT_CONTAINER_LABELS: Record<ExportContainer, string> = {
	mp4: "MP4",
	webm: "WebM",
	mov: "MOV",
};

export const EXPORT_QUALITY_VALUES = [
	"smaller",
	"balanced",
	"high",
	"maximum",
	"custom",
] as const;
export type ExportQualityPreset = (typeof EXPORT_QUALITY_VALUES)[number];

export const EXPORT_QUALITY_LABELS: Record<ExportQualityPreset, string> = {
	smaller: "Arquivo menor",
	balanced: "Equilibrada",
	high: "Alta",
	maximum: "Máxima",
	custom: "Personalizada",
};

export type BitrateMode = "variable" | "constant";
export type HardwareAccelPreference = "no-preference" | "prefer-hardware" | "prefer-software";

export interface ExportResolutionOptions {
	preset: ResolutionPreset;
	/** Required when `preset === "custom"`. */
	custom?: Size;
	/** Locks width/height together when editing the custom fields in the UI — not read by the encoder. */
	lockAspectRatio?: boolean;
}

export interface ExportAudioOptions {
	include: boolean;
	codec: AudioCodec;
	bitrate: number;
	sampleRate: 44_100 | 48_000;
	channels: 1 | 2;
}

export interface ExportOptions {
	filename: string;
	container: ExportContainer;
	codec: VideoCodec;
	resolution: ExportResolutionOptions;
	/** "project" or one of `EXPORT_FRAME_RATE_OPTIONS`' ids (see ./frame-rates). */
	frameRateId: string;
	quality: ExportQualityPreset;
	/** Always a concrete bits/sec value — derived from `quality` unless `quality === "custom"`. */
	videoBitrate: number;
	bitrateMode: BitrateMode;
	hardwareAcceleration: HardwareAccelPreference;
	audio: ExportAudioOptions;
}

/** Resolved, encoder-ready settings — `frameRateId`/`resolution.preset` resolved to concrete values. */
export interface ResolvedExportSettings {
	width: number;
	height: number;
	fps: FrameRate;
}

export interface ExportResult {
	success: boolean;
	buffer?: ArrayBuffer;
	error?: string;
	cancelled?: boolean;
}

export interface ExportState {
	isExporting: boolean;
	progress: number;
	result: ExportResult | null;
	startedAt?: number;
}

export function getExportMimeType({
	container,
}: {
	container: ExportContainer;
}): string {
	return EXPORT_MIME_TYPES[container];
}

export function getExportFileExtension({
	container,
}: {
	container: ExportContainer;
}): string {
	return `.${container}`;
}

export function downloadBuffer({
	buffer,
	filename,
	mimeType,
}: {
	buffer: ArrayBuffer;
	filename: string;
	mimeType: string;
}): void {
	const blob = new Blob([buffer], { type: mimeType });
	const url = URL.createObjectURL(blob);
	const downloadLink = document.createElement("a");
	downloadLink.href = url;
	downloadLink.download = filename;
	document.body.appendChild(downloadLink);
	downloadLink.click();
	document.body.removeChild(downloadLink);
	URL.revokeObjectURL(url);
}
