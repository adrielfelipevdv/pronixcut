import type { EffectDefinition } from "@/effects/types";
import { hexToRgb01 } from "@/utils/color";

export const CHROMA_KEY_SHADER = "chroma-key";
export const CHROMA_KEY_EFFECT_TYPE = "chromaKey";

function readNumberParam({
	effectParams,
	key,
	fallback,
}: {
	effectParams: Record<string, unknown>;
	key: string;
	fallback: number;
}): number {
	const raw = effectParams[key];
	return typeof raw === "number" ? raw : fallback;
}

export const chromaKeyEffectDefinition: EffectDefinition = {
	type: CHROMA_KEY_EFFECT_TYPE,
	name: "Chroma Key",
	keywords: ["chroma", "key", "green screen", "greenscreen", "croma"],
	params: [
		{
			key: "keyColor",
			label: "Cor da tela",
			type: "color",
			default: "#00ff00",
		},
		{
			key: "similarity",
			label: "Similaridade",
			type: "number",
			default: 0.35,
			min: 0,
			max: 1,
			step: 0.01,
		},
		{
			key: "softness",
			label: "Suavidade",
			type: "number",
			default: 0.15,
			min: 0.001,
			max: 1,
			step: 0.01,
		},
		{
			key: "feather",
			label: "Pluma (borda)",
			type: "number",
			default: 0,
			min: 0,
			max: 12,
			step: 0.5,
		},
		{
			key: "spill",
			label: "Remover contaminação",
			type: "number",
			default: 0.5,
			min: 0,
			max: 1,
			step: 0.01,
		},
		{
			key: "opacity",
			label: "Intensidade",
			type: "number",
			default: 1,
			min: 0,
			max: 1,
			step: 0.01,
		},
	],
	renderer: {
		kind: "gpu",
		passes: [
			{
				shader: CHROMA_KEY_SHADER,
				uniforms: ({ effectParams }) => {
					const keyColorHex =
						typeof effectParams.keyColor === "string"
							? effectParams.keyColor
							: "#00ff00";
					return {
						u_key_color: hexToRgb01({ hex: keyColorHex }),
						u_similarity: readNumberParam({
							effectParams,
							key: "similarity",
							fallback: 0.35,
						}),
						u_softness: Math.max(
							readNumberParam({ effectParams, key: "softness", fallback: 0.15 }),
							0.001,
						),
						u_feather: readNumberParam({ effectParams, key: "feather", fallback: 0 }),
						u_spill: readNumberParam({ effectParams, key: "spill", fallback: 0.5 }),
						u_opacity: readNumberParam({ effectParams, key: "opacity", fallback: 1 }),
					};
				},
			},
		],
	},
};
