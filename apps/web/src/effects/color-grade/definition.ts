import type { EffectDefinition } from "@/effects/types";
import { COLOR_GRADE_PARAMS } from "./params";
import { buildColorGradeFilter, drawColorGradeOverlay } from "./render";

export const COLOR_GRADE_EFFECT_TYPE = "colorGrade";

export const colorGradeEffectDefinition: EffectDefinition = {
	type: COLOR_GRADE_EFFECT_TYPE,
	name: "Color Grade",
	keywords: ["color", "grade", "filter", "look", "grading", "correção de cor"],
	params: COLOR_GRADE_PARAMS,
	renderer: {
		kind: "canvas2d",
		filter: buildColorGradeFilter,
		overlay: drawColorGradeOverlay,
	},
};
