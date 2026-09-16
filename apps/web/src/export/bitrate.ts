import type { ExportQualityPreset } from "./index";

// Standard "bits per pixel per frame" heuristic (bitrate = width * height *
// fps * bpp) — the same approach real encoders' presets are built from.
// Values chosen conservatively for H.264/H.265-class codecs at each tier.
const QUALITY_BITS_PER_PIXEL: Record<Exclude<ExportQualityPreset, "custom">, number> = {
	smaller: 0.035,
	balanced: 0.07,
	high: 0.11,
	maximum: 0.16,
};

export function getRecommendedVideoBitrate({
	width,
	height,
	fps,
	quality,
}: {
	width: number;
	height: number;
	fps: number;
	quality: Exclude<ExportQualityPreset, "custom">;
}): number {
	const bpp = QUALITY_BITS_PER_PIXEL[quality];
	const bitrate = width * height * fps * bpp;
	// Clamp to a sane range so tiny/huge frames don't produce absurd bitrates.
	return Math.round(Math.min(200_000_000, Math.max(300_000, bitrate)));
}
