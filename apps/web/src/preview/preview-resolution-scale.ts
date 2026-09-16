import type { TCanvasSize } from "@/project/types";

/**
 * Editor preference only — how many pixels the Viewer's internal render
 * target uses relative to the project's real canvas resolution. Never
 * confuse with `project.settings.canvasSize` (the project's actual
 * resolution/aspect ratio) or export resolution/quality — those are
 * completely separate concerns and this value never reaches either.
 */
export type PreviewResolutionScaleSetting =
	| "auto"
	| "full"
	| "half"
	| "quarter"
	| "eighth";

export const PREVIEW_RESOLUTION_SCALE_OPTIONS: Array<{
	value: PreviewResolutionScaleSetting;
	label: string;
}> = [
	{ value: "auto", label: "Automática" },
	{ value: "full", label: "Completa" },
	{ value: "half", label: "1/2" },
	{ value: "quarter", label: "1/4" },
	{ value: "eighth", label: "1/8" },
];

const FIXED_SCALE_FACTORS: Record<Exclude<PreviewResolutionScaleSetting, "auto">, number> = {
	full: 1,
	half: 0.5,
	quarter: 0.25,
	eighth: 0.125,
};

/**
 * "Automática" rule — deliberately simple and predictable (per spec: no
 * complex heuristics, and never flip-flop during playback). It's evaluated
 * once from the project's own canvas resolution, not from live FPS/perf
 * sampling, so it can never "flap" between qualities while playing.
 */
function resolveAutoScale({ canvasSize }: { canvasSize: TCanvasSize }): number {
	const pixelCount = canvasSize.width * canvasSize.height;
	const FHD_PIXELS = 1920 * 1080;
	const QHD_PIXELS = 2560 * 1440;

	if (pixelCount <= FHD_PIXELS) return 1;
	if (pixelCount <= QHD_PIXELS * 1.2) return 0.5;
	return 0.25;
}

export interface EffectivePreviewResolution {
	/** 1 = full project resolution, 0.5 = half, etc. */
	scale: number;
	/** Whether the effective scale is below 1 (i.e. the Viewer is actually rendering at reduced resolution right now). */
	isReduced: boolean;
	/** Short label for the on-viewer indicator, e.g. "1/2", "1/4" — omitted (null) at full resolution. */
	indicatorLabel: string | null;
}

export function resolveEffectivePreviewResolution({
	setting,
	canvasSize,
}: {
	setting: PreviewResolutionScaleSetting;
	canvasSize: TCanvasSize;
}): EffectivePreviewResolution {
	const scale =
		setting === "auto"
			? resolveAutoScale({ canvasSize })
			: FIXED_SCALE_FACTORS[setting];

	const indicatorLabel =
		scale >= 1
			? null
			: scale === 0.5
				? "1/2"
				: scale === 0.25
					? "1/4"
					: scale === 0.125
						? "1/8"
						: `${Math.round(scale * 100)}%`;

	return { scale, isReduced: scale < 1, indicatorLabel };
}
