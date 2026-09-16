import {
	canEncodeAudio,
	canEncodeVideo,
	getEncodableAudioCodecs,
	getEncodableVideoCodecs,
	type AudioCodec,
	type VideoCodec,
} from "mediabunny";
import type { ExportContainer } from "./index";

// Real WebCodecs capability probes (via mediabunny, which wraps
// `VideoEncoder.isConfigSupported`/`AudioEncoder.isConfigSupported`) — never
// a hardcoded "this browser supports X" list. Results are cached per
// session since they don't change while the app is open, and probing is
// async (real encoder queries), so callers should expect a brief "checking…"
// state on first use.

const CONTAINER_VIDEO_CODECS: Record<ExportContainer, VideoCodec[]> = {
	mp4: ["avc", "hevc", "av1"],
	webm: ["vp9", "av1", "vp8"],
	mov: ["avc", "hevc", "av1"],
};

const CONTAINER_AUDIO_CODECS: Record<ExportContainer, AudioCodec[]> = {
	mp4: ["aac", "opus"],
	webm: ["opus", "vorbis"],
	mov: ["aac", "opus"],
};

export const VIDEO_CODEC_LABELS: Record<VideoCodec, string> = {
	avc: "H.264",
	hevc: "H.265 / HEVC",
	av1: "AV1",
	vp9: "VP9",
	vp8: "VP8",
};

export const AUDIO_CODEC_LABELS: Record<AudioCodec, string> = {
	aac: "AAC",
	opus: "Opus",
	mp3: "MP3",
	vorbis: "Vorbis",
	flac: "FLAC",
	ac3: "AC-3",
	eac3: "E-AC-3",
	"pcm-s16": "PCM 16-bit",
	"pcm-s16be": "PCM 16-bit (BE)",
	"pcm-s24": "PCM 24-bit",
	"pcm-s24be": "PCM 24-bit (BE)",
	"pcm-s32": "PCM 32-bit",
	"pcm-s32be": "PCM 32-bit (BE)",
	"pcm-f32": "PCM float32",
	"pcm-f32be": "PCM float32 (BE)",
	"pcm-f64": "PCM float64",
	"pcm-f64be": "PCM float64 (BE)",
	"pcm-u8": "PCM 8-bit",
	"pcm-s8": "PCM 8-bit (signed)",
	ulaw: "u-law",
	alaw: "a-law",
};

let videoCodecCache: Promise<VideoCodec[]> | null = null;
let audioCodecCache: Promise<AudioCodec[]> | null = null;
let hardwareAccelCache: Promise<boolean> | null = null;

async function getAllEncodableVideoCodecs(): Promise<VideoCodec[]> {
	if (!videoCodecCache) {
		videoCodecCache = getEncodableVideoCodecs();
	}
	return videoCodecCache;
}

async function getAllEncodableAudioCodecs(): Promise<AudioCodec[]> {
	if (!audioCodecCache) {
		audioCodecCache = getEncodableAudioCodecs();
	}
	return audioCodecCache;
}

/** Video codecs this browser can actually encode, for the given container — real support only. */
export async function getEncodableVideoCodecsForContainer({
	container,
}: {
	container: ExportContainer;
}): Promise<VideoCodec[]> {
	const [encodable, allowedForContainer] = await Promise.all([
		getAllEncodableVideoCodecs(),
		CONTAINER_VIDEO_CODECS[container],
	]);
	return allowedForContainer.filter((codec) => encodable.includes(codec));
}

/** Audio codecs this browser can actually encode, for the given container — real support only. */
export async function getEncodableAudioCodecsForContainer({
	container,
}: {
	container: ExportContainer;
}): Promise<AudioCodec[]> {
	const [encodable, allowedForContainer] = await Promise.all([
		getAllEncodableAudioCodecs(),
		CONTAINER_AUDIO_CODECS[container],
	]);
	return allowedForContainer.filter((codec) => encodable.includes(codec));
}

/** Whether a specific video codec is actually encodable at the given resolution/bitrate (a stricter, more precise probe than the generic list above). */
export function canEncodeVideoCodec({
	codec,
	width,
	height,
	bitrate,
}: {
	codec: VideoCodec;
	width: number;
	height: number;
	bitrate: number;
}): Promise<boolean> {
	return canEncodeVideo(codec, { width, height, bitrate });
}

export function canEncodeAudioCodec({
	codec,
	sampleRate,
	numberOfChannels,
	bitrate,
}: {
	codec: AudioCodec;
	sampleRate: number;
	numberOfChannels: number;
	bitrate: number;
}): Promise<boolean> {
	return canEncodeAudio(codec, { sampleRate, numberOfChannels, bitrate });
}

/**
 * Whether hardware-accelerated encoding is available for at least one
 * common codec on this machine. WebCodecs never reports the vendor
 * (NVENC/QuickSync/AMF) — only whether a hardware path exists — so the UI
 * must label this generically ("Hardware (GPU)"), never a brand name.
 */
export async function isHardwareEncodingAvailable(): Promise<boolean> {
	if (!hardwareAccelCache) {
		hardwareAccelCache = (async () => {
			if (typeof VideoEncoder === "undefined") return false;
			try {
				const { supported } = await VideoEncoder.isConfigSupported({
					codec: "avc1.42001f",
					width: 1280,
					height: 720,
					hardwareAcceleration: "prefer-hardware",
				});
				return Boolean(supported);
			} catch {
				return false;
			}
		})();
	}
	return hardwareAccelCache;
}
