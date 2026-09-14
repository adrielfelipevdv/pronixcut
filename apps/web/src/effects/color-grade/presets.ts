import type { ColorGradeValues } from "./params";
import { COLOR_GRADE_NEUTRAL } from "./params";

export interface ColorGradePreset {
	id: string;
	name: string;
	values: Partial<ColorGradeValues>;
}

function preset(id: string, name: string, values: Partial<ColorGradeValues>): ColorGradePreset {
	return { id, name, values };
}

// 15 built-in looks, inspired by the categories/possibilities common to
// modern editors (CapCut Desktop, etc.) — original PronixCut parameter
// combinations, not copied assets or proprietary presets.
export const BUILTIN_COLOR_GRADE_PRESETS: ColorGradePreset[] = [
	preset("cinema", "Cinema", {
		contrast: 18,
		highlights: -10,
		shadows: 12,
		temperature: 6,
		saturation: -8,
		vignette: 22,
	}),
	preset("contraste", "Contraste", {
		contrast: 30,
		blacks: -10,
		whites: 10,
	}),
	preset("quente", "Quente", {
		temperature: 45,
		saturation: 8,
		highlights: 6,
	}),
	preset("frio", "Frio", {
		temperature: -45,
		saturation: 4,
		shadows: -6,
	}),
	preset("vibrante", "Vibrante", {
		vibrance: 45,
		saturation: 20,
		contrast: 8,
	}),
	preset("dessaturado", "Dessaturado", {
		saturation: -55,
		contrast: 6,
	}),
	preset("preto-e-branco", "Preto e branco", {
		saturation: -100,
		contrast: 15,
		highlights: -6,
	}),
	preset("vintage", "Vintage", {
		saturation: -25,
		temperature: 18,
		fade: 30,
		vignette: 20,
		grain: 22,
	}),
	preset("fade", "Fade", {
		fade: 45,
		contrast: -10,
		saturation: -12,
	}),
	preset("high-contrast", "High Contrast", {
		contrast: 55,
		blacks: -20,
		whites: 18,
		saturation: 6,
	}),
	preset("soft", "Soft", {
		contrast: -14,
		highlights: -8,
		shadows: 10,
		saturation: -6,
	}),
	preset("dramatico", "Dramático", {
		contrast: 35,
		shadows: -22,
		highlights: -14,
		vignette: 35,
		saturation: -10,
	}),
	preset("verde-teal", "Verde/Teal", {
		temperature: -20,
		hue: 12,
		shadows: 8,
		saturation: 10,
	}),
	preset("laranja", "Laranja", {
		temperature: 35,
		hue: -6,
		highlights: 8,
		saturation: 12,
	}),
	preset("baixa-saturacao", "Baixa saturação", {
		saturation: -35,
	}),
];

export function presetToEffectParams(values: Partial<ColorGradeValues>): Record<string, number> {
	return { ...COLOR_GRADE_NEUTRAL, ...values };
}
