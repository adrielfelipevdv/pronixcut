import { getCurveHandlesForNormalizedCubicBezier } from "./curve-bridge";
import type {
	NormalizedCubicBezier,
	ScalarAnimationKey,
	ScalarCurveKeyframePatch,
} from "./types";

/**
 * Standard CSS-style easing curves, expressed the same way as
 * `cubic-bezier(x1,y1,x2,y2)` — reused as-is through the existing
 * bezier/curve-handle machinery (`curve-bridge.ts`) rather than building a
 * second interpolation engine. "Linear" isn't a bezier at all; it maps to the
 * existing `segmentToNext: "linear"` segment type.
 */
export const EASING_PRESETS = {
	linear: null,
	"ease-in": [0.42, 0, 1, 1],
	"ease-out": [0, 0, 0.58, 1],
	"ease-in-out": [0.42, 0, 0.58, 1],
} as const satisfies Record<string, NormalizedCubicBezier | null>;

export type EasingPresetId = keyof typeof EASING_PRESETS;

export const EASING_PRESET_OPTIONS: Array<{ value: EasingPresetId; label: string }> = [
	{ value: "linear", label: "Linear" },
	{ value: "ease-in", label: "Ease In" },
	{ value: "ease-out", label: "Ease Out" },
	{ value: "ease-in-out", label: "Ease In-Out" },
];

/**
 * Builds the two curve patches needed to shape the segment FROM `leftKey` TO
 * `rightKey` as the given easing preset — one for `leftKey`'s own
 * `rightHandle` (its outgoing tangent) and one for `rightKey`'s own
 * `leftHandle` (its incoming tangent), since a segment's shape is split
 * across both endpoints (see `getNormalizedCubicBezierForScalarSegment`).
 * Both must be applied (as one batched command) for the curve to take effect.
 */
export function buildEasingCurvePatches({
	easing,
	leftKey,
	rightKey,
}: {
	easing: EasingPresetId;
	leftKey: ScalarAnimationKey;
	rightKey: ScalarAnimationKey;
}): { leftKeyPatch: ScalarCurveKeyframePatch; rightKeyPatch: ScalarCurveKeyframePatch } {
	const cubicBezier = EASING_PRESETS[easing];
	const linear: ScalarCurveKeyframePatch = {
		segmentToNext: "linear",
		leftHandle: null,
		rightHandle: null,
	};
	if (!cubicBezier) {
		return { leftKeyPatch: linear, rightKeyPatch: {} };
	}

	const handles = getCurveHandlesForNormalizedCubicBezier({
		leftKey,
		rightKey,
		cubicBezier,
	});
	if (!handles) {
		return { leftKeyPatch: linear, rightKeyPatch: {} };
	}

	return {
		leftKeyPatch: {
			segmentToNext: "bezier",
			tangentMode: "broken",
			rightHandle: handles.rightHandle,
		},
		rightKeyPatch: {
			tangentMode: "broken",
			leftHandle: handles.leftHandle,
		},
	};
}

/** Reads back which named preset (if any) the outgoing segment from `leftKey` currently matches — "linear" for a plain linear/step segment, `null` when it's a bezier shape that doesn't correspond to one of the presets (custom curve editing). */
export function getEasingPresetForSegment({
	leftKey,
}: {
	leftKey: ScalarAnimationKey;
}): EasingPresetId | "linear" | null {
	if (leftKey.segmentToNext !== "bezier") {
		return leftKey.segmentToNext === "linear" ? "linear" : null;
	}
	return null;
}
