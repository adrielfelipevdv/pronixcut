import type { ExportOptions } from "./index";

export interface QuickExportPreset {
	id: string;
	label: string;
	/** Returns a full ExportOptions patch — real settings, not just a label swap. */
	apply: (base: ExportOptions) => ExportOptions;
}

const withAudio = (
	base: ExportOptions,
	patch: Partial<ExportOptions["audio"]>,
): ExportOptions["audio"] => ({ ...base.audio, ...patch });

export const QUICK_EXPORT_PRESETS: QuickExportPreset[] = [
	{
		id: "youtube-1080p",
		label: "YouTube 1080p",
		apply: (base) => ({
			...base,
			container: "mp4",
			codec: "avc",
			resolution: { preset: "1080p" },
			frameRateId: "project",
			quality: "high",
			audio: withAudio(base, { codec: "aac", bitrate: 192_000 }),
		}),
	},
	{
		id: "youtube-4k",
		label: "YouTube 4K",
		apply: (base) => ({
			...base,
			container: "mp4",
			codec: "avc",
			resolution: { preset: "2160p" },
			frameRateId: "project",
			quality: "maximum",
			audio: withAudio(base, { codec: "aac", bitrate: 320_000 }),
		}),
	},
	{
		id: "reels-shorts",
		label: "Reels / Shorts 1080x1920",
		apply: (base) => ({
			...base,
			container: "mp4",
			codec: "avc",
			resolution: { preset: "custom", custom: { width: 1080, height: 1920 } },
			frameRateId: "project",
			quality: "high",
			audio: withAudio(base, { codec: "aac", bitrate: 192_000 }),
		}),
	},
	{
		id: "tiktok",
		label: "TikTok 1080x1920",
		apply: (base) => ({
			...base,
			container: "mp4",
			codec: "avc",
			resolution: { preset: "custom", custom: { width: 1080, height: 1920 } },
			frameRateId: "project",
			quality: "high",
			audio: withAudio(base, { codec: "aac", bitrate: 192_000 }),
		}),
	},
	{
		id: "instagram-feed",
		label: "Instagram Feed 1080x1350",
		apply: (base) => ({
			...base,
			container: "mp4",
			codec: "avc",
			resolution: { preset: "custom", custom: { width: 1080, height: 1350 } },
			frameRateId: "project",
			quality: "high",
			audio: withAudio(base, { codec: "aac", bitrate: 192_000 }),
		}),
	},
	{
		id: "high-quality",
		label: "Alta qualidade",
		apply: (base) => ({
			...base,
			quality: "maximum",
			audio: withAudio(base, { bitrate: 320_000 }),
		}),
	},
	{
		id: "lightweight",
		label: "Arquivo leve",
		apply: (base) => ({
			...base,
			resolution: { preset: "720p" },
			quality: "smaller",
			audio: withAudio(base, { bitrate: 128_000 }),
		}),
	},
];
