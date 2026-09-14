import type { NumberParamDefinition } from "@/params";

// Grouped as in the spec: LUZ (light), COR (color), DETALHES (details) —
// order here also decides display order in the flat effect params list.
function num(
	key: string,
	label: string,
	{
		min = -100,
		max = 100,
		default: def = 0,
		step = 1,
	}: { min?: number; max?: number; default?: number; step?: number } = {},
): NumberParamDefinition {
	return { key, label, type: "number", default: def, min, max, step };
}

export const COLOR_GRADE_LIGHT_PARAMS: NumberParamDefinition[] = [
	num("exposure", "Exposição"),
	num("brightness", "Brilho"),
	num("contrast", "Contraste"),
	num("highlights", "Realces"),
	num("shadows", "Sombras"),
	num("whites", "Brancos"),
	num("blacks", "Pretos"),
];

export const COLOR_GRADE_COLOR_PARAMS: NumberParamDefinition[] = [
	num("temperature", "Temperatura"),
	num("hue", "Matiz", { min: -180, max: 180 }),
	num("saturation", "Saturação"),
	num("vibrance", "Vibrância"),
];

export const COLOR_GRADE_DETAIL_PARAMS: NumberParamDefinition[] = [
	num("fade", "Fade", { min: 0, max: 100 }),
	num("vignette", "Vinheta", { min: 0, max: 100 }),
	num("grain", "Granulação", { min: 0, max: 100 }),
];

export const COLOR_GRADE_INTENSITY_PARAM: NumberParamDefinition = num(
	"intensity",
	"Intensidade",
	{ min: 0, max: 100, default: 100, step: 1 },
);

export const COLOR_GRADE_PARAMS: NumberParamDefinition[] = [
	COLOR_GRADE_INTENSITY_PARAM,
	...COLOR_GRADE_LIGHT_PARAMS,
	...COLOR_GRADE_COLOR_PARAMS,
	...COLOR_GRADE_DETAIL_PARAMS,
];

export interface ColorGradeValues {
	intensity: number;
	exposure: number;
	brightness: number;
	contrast: number;
	highlights: number;
	shadows: number;
	whites: number;
	blacks: number;
	temperature: number;
	hue: number;
	saturation: number;
	vibrance: number;
	fade: number;
	vignette: number;
	grain: number;
}

export const COLOR_GRADE_NEUTRAL: ColorGradeValues = {
	intensity: 100,
	exposure: 0,
	brightness: 0,
	contrast: 0,
	highlights: 0,
	shadows: 0,
	whites: 0,
	blacks: 0,
	temperature: 0,
	hue: 0,
	saturation: 0,
	vibrance: 0,
	fade: 0,
	vignette: 0,
	grain: 0,
};

export function readColorGradeValues(
	effectParams: Record<string, unknown>,
): ColorGradeValues {
	const read = (key: keyof ColorGradeValues): number => {
		const raw = effectParams[key];
		const value = typeof raw === "number" ? raw : Number.parseFloat(String(raw));
		return Number.isFinite(value) ? value : COLOR_GRADE_NEUTRAL[key];
	};
	return {
		intensity: read("intensity"),
		exposure: read("exposure"),
		brightness: read("brightness"),
		contrast: read("contrast"),
		highlights: read("highlights"),
		shadows: read("shadows"),
		whites: read("whites"),
		blacks: read("blacks"),
		temperature: read("temperature"),
		hue: read("hue"),
		saturation: read("saturation"),
		vibrance: read("vibrance"),
		fade: read("fade"),
		vignette: read("vignette"),
		grain: read("grain"),
	};
}

/** Scales every param toward its neutral (0) value by `intensity`, so "Intensidade" applies only part of the treatment. */
export function applyIntensity(values: ColorGradeValues): ColorGradeValues {
	const mix = Math.max(0, Math.min(100, values.intensity)) / 100;
	if (mix === 1) return values;
	const scaled = { ...values };
	for (const key of Object.keys(values) as Array<keyof ColorGradeValues>) {
		if (key === "intensity") continue;
		scaled[key] = values[key] * mix;
	}
	return scaled;
}
