import { DEFAULT_CURVE_POINTS, isIdentityCurve, type CurvePoint } from "./curve-math";
import { buildNeutralHsl, type HslValues } from "./hsl-bands";

// The color-grade effect's `ParamValues` only allows number|string|boolean
// per param (see @/params `ParamValue`), so structures that don't fit that
// shape (per-hue bands, curve point lists) are stored as JSON strings under
// their own keys and read/written through the helpers below — the same
// effect instance, just a couple of keys the generic params UI (which only
// iterates `definition.params`) never sees or tries to render.

export const HSL_PARAM_KEY = "hsl";
export const CURVE_RGB_PARAM_KEY = "curveRgb";
export const CURVE_RED_PARAM_KEY = "curveRed";
export const CURVE_GREEN_PARAM_KEY = "curveGreen";
export const CURVE_BLUE_PARAM_KEY = "curveBlue";
export const LUT_ID_PARAM_KEY = "lutId";

export type CurveChannelKey = "rgb" | "red" | "green" | "blue";

export const CURVE_PARAM_KEY_BY_CHANNEL: Record<CurveChannelKey, string> = {
	rgb: CURVE_RGB_PARAM_KEY,
	red: CURVE_RED_PARAM_KEY,
	green: CURVE_GREEN_PARAM_KEY,
	blue: CURVE_BLUE_PARAM_KEY,
};

export interface CurvesValues {
	rgb: CurvePoint[];
	red: CurvePoint[];
	green: CurvePoint[];
	blue: CurvePoint[];
}

export function buildNeutralCurves(): CurvesValues {
	return {
		rgb: [...DEFAULT_CURVE_POINTS],
		red: [...DEFAULT_CURVE_POINTS],
		green: [...DEFAULT_CURVE_POINTS],
		blue: [...DEFAULT_CURVE_POINTS],
	};
}

function readJsonPoints({
	raw,
}: {
	raw: unknown;
}): CurvePoint[] {
	if (typeof raw !== "string" || !raw) return [...DEFAULT_CURVE_POINTS];
	try {
		const parsed = JSON.parse(raw);
		if (
			Array.isArray(parsed) &&
			parsed.every(
				(p) => p && typeof p.x === "number" && typeof p.y === "number",
			) &&
			parsed.length >= 2
		) {
			return parsed as CurvePoint[];
		}
	} catch {
		// fall through to identity
	}
	return [...DEFAULT_CURVE_POINTS];
}

export function readCurvesFromParams(
	effectParams: Record<string, unknown>,
): CurvesValues {
	return {
		rgb: readJsonPoints({ raw: effectParams[CURVE_RGB_PARAM_KEY] }),
		red: readJsonPoints({ raw: effectParams[CURVE_RED_PARAM_KEY] }),
		green: readJsonPoints({ raw: effectParams[CURVE_GREEN_PARAM_KEY] }),
		blue: readJsonPoints({ raw: effectParams[CURVE_BLUE_PARAM_KEY] }),
	};
}

export function writeCurveChannelParam({
	channel,
	points,
}: {
	channel: CurveChannelKey;
	points: CurvePoint[];
}): { key: string; value: string } {
	return {
		key: CURVE_PARAM_KEY_BY_CHANNEL[channel],
		value: JSON.stringify(points),
	};
}

export function readHslFromParams(
	effectParams: Record<string, unknown>,
): HslValues {
	const raw = effectParams[HSL_PARAM_KEY];
	if (typeof raw !== "string" || !raw) return buildNeutralHsl();
	try {
		const parsed = JSON.parse(raw);
		const neutral = buildNeutralHsl();
		if (parsed && typeof parsed === "object") {
			for (const key of Object.keys(neutral) as Array<keyof HslValues>) {
				const band = parsed[key];
				if (
					band &&
					typeof band.hue === "number" &&
					typeof band.saturation === "number" &&
					typeof band.lightness === "number"
				) {
					neutral[key] = band;
				}
			}
		}
		return neutral;
	} catch {
		return buildNeutralHsl();
	}
}

export function writeHslParam(values: HslValues): { key: string; value: string } {
	return { key: HSL_PARAM_KEY, value: JSON.stringify(values) };
}

export function readLutId(effectParams: Record<string, unknown>): string | null {
	const raw = effectParams[LUT_ID_PARAM_KEY];
	return typeof raw === "string" && raw ? raw : null;
}

export function isCurvesNeutral(curves: CurvesValues): boolean {
	return (
		isIdentityCurve(curves.rgb) &&
		isIdentityCurve(curves.red) &&
		isIdentityCurve(curves.green) &&
		isIdentityCurve(curves.blue)
	);
}
