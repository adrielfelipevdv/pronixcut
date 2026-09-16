import type { FrameRate } from "opencut-wasm";
import type { ExportOptions, ResolvedExportSettings } from "./index";
import { computeResolutionForPreset, type Size } from "./resolution";
import { EXPORT_FRAME_RATE_OPTIONS } from "./frame-rates";
import { getRecommendedVideoBitrate } from "./bitrate";
import { frameRateToFloat } from "@/fps/utils";

/** Resolves "Igual ao projeto" / preset ids to concrete encoder-ready values — the single place the UI (for the summary/estimate) and the actual export call both go through, so they can never disagree. */
export function resolveExportSettings({
	options,
	projectSize,
	projectFps,
}: {
	options: ExportOptions;
	projectSize: Size;
	projectFps: FrameRate;
}): ResolvedExportSettings {
	const { width, height } = computeResolutionForPreset({
		preset: options.resolution.preset,
		projectSize,
		custom: options.resolution.custom,
	});

	const fps =
		options.frameRateId === "project"
			? projectFps
			: (EXPORT_FRAME_RATE_OPTIONS.find((option) => option.id === options.frameRateId)
					?.rate ?? projectFps);

	return { width, height, fps };
}

/** Resolves the video bitrate that will actually be handed to the encoder — the quality preset's recommended bitrate, or the user's custom value. */
export function resolveVideoBitrate({
	options,
	resolved,
}: {
	options: ExportOptions;
	resolved: ResolvedExportSettings;
}): number {
	if (options.quality === "custom") {
		return options.videoBitrate;
	}
	return getRecommendedVideoBitrate({
		width: resolved.width,
		height: resolved.height,
		fps: frameRateToFloat(resolved.fps),
		quality: options.quality,
	});
}
