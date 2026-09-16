export const HSL_CHANNEL_KEYS = [
	"red",
	"orange",
	"yellow",
	"green",
	"cyan",
	"blue",
	"purple",
	"magenta",
] as const;

export type HslChannelKey = (typeof HSL_CHANNEL_KEYS)[number];

export interface HslBandAdjust {
	hue: number; // -100..100 (maps to a hue shift in degrees, see webgl/grade-pass)
	saturation: number; // -100..100
	lightness: number; // -100..100
}

/** Center hue (degrees, 0..360) and swatch color for each band's selector chip and the GPU hue-distance weighting — keep in sync with the GLSL `hueBandCenters` array in webgl/grade-pass.ts. */
export const HSL_BAND_INFO: Record<
	HslChannelKey,
	{ label: string; hueDeg: number; swatch: string }
> = {
	red: { label: "Vermelho", hueDeg: 0, swatch: "#ef4444" },
	orange: { label: "Laranja", hueDeg: 30, swatch: "#f97316" },
	yellow: { label: "Amarelo", hueDeg: 60, swatch: "#eab308" },
	green: { label: "Verde", hueDeg: 120, swatch: "#22c55e" },
	cyan: { label: "Ciano", hueDeg: 180, swatch: "#06b6d4" },
	blue: { label: "Azul", hueDeg: 240, swatch: "#3b82f6" },
	purple: { label: "Roxo", hueDeg: 270, swatch: "#a855f7" },
	magenta: { label: "Magenta", hueDeg: 320, swatch: "#ec4899" },
};

export const HSL_BAND_NEUTRAL: HslBandAdjust = { hue: 0, saturation: 0, lightness: 0 };

export type HslValues = Record<HslChannelKey, HslBandAdjust>;

export function buildNeutralHsl(): HslValues {
	const values = {} as HslValues;
	for (const key of HSL_CHANNEL_KEYS) {
		values[key] = { ...HSL_BAND_NEUTRAL };
	}
	return values;
}

export function isHslNeutral(values: HslValues): boolean {
	return HSL_CHANNEL_KEYS.every(
		(key) =>
			values[key].hue === 0 &&
			values[key].saturation === 0 &&
			values[key].lightness === 0,
	);
}
