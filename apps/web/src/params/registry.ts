import type {
	ParamDefinition,
	ParamValue,
	ParamValues,
} from "@/params";
import { MIN_TRANSFORM_SCALE } from "@/animation/transform";
import type { BlendMode } from "@/rendering";
import type {
	ElementType,
	TimelineElement,
} from "@/timeline";
import { DEFAULTS } from "@/timeline/defaults";
import { VOLUME_DB_MAX, VOLUME_DB_MIN } from "@/timeline/audio-constants";
import {
	CORNER_RADIUS_MAX,
	CORNER_RADIUS_MIN,
} from "@/text/background";
import { INSTAGRAM_QUESTION_DEFAULTS } from "@/stickers/instagram-question/card";

export type ElementParamDefinition<TKey extends string = string> =
	ParamDefinition<TKey> & {
		read?: ({ element }: { element: TimelineElement }) => ParamValue | null;
		write?: ({
			element,
			value,
		}: {
			element: TimelineElement;
			value: ParamValue;
		}) => TimelineElement;
	};

export function buildDefaultParamValues(
	params: readonly ParamDefinition[],
): ParamValues {
	const values: ParamValues = {};
	for (const param of params) {
		values[param.key] = param.default;
	}
	return values;
}

export class DefinitionRegistry<TKey extends string, TDefinition> {
	private definitions = new Map<TKey, TDefinition>();
	private entityName: string;

	constructor(entityName: string) {
		this.entityName = entityName;
	}

	register({
		key,
		definition,
	}: {
		key: TKey;
		definition: TDefinition;
	}): void {
		this.definitions.set(key, definition);
	}

	has(key: TKey): boolean {
		return this.definitions.has(key);
	}

	get(key: TKey): TDefinition {
		const def = this.definitions.get(key);
		if (!def) {
			throw new Error(`Unknown ${this.entityName}: ${key}`);
		}
		return def;
	}

	getAll(): TDefinition[] {
		return Array.from(this.definitions.values());
	}
}

const BLEND_MODE_OPTIONS: Array<{ value: BlendMode; label: string }> = [
	{ value: "normal", label: "Normal" },
	{ value: "darken", label: "Escurecer" },
	{ value: "multiply", label: "Multiplicar" },
	{ value: "color-burn", label: "Queima de cor" },
	{ value: "lighten", label: "Clarear" },
	{ value: "screen", label: "Tela" },
	{ value: "plus-lighter", label: "Mais claro" },
	{ value: "color-dodge", label: "Sub-exposição de cor" },
	{ value: "overlay", label: "Sobreposição" },
	{ value: "soft-light", label: "Luz suave" },
	{ value: "hard-light", label: "Luz forte" },
	{ value: "difference", label: "Diferença" },
	{ value: "exclusion", label: "Exclusão" },
	{ value: "hue", label: "Matiz" },
	{ value: "saturation", label: "Saturação" },
	{ value: "color", label: "Cor" },
	{ value: "luminosity", label: "Luminosidade" },
];

const visualElementParams: ElementParamDefinition[] = [
	{
		key: "transform.positionX",
		label: "Posição X",
		type: "number",
		default: DEFAULTS.element.transform.position.x,
		min: -100_000,
		step: 1,
	},
	{
		key: "transform.positionY",
		label: "Posição Y",
		type: "number",
		default: DEFAULTS.element.transform.position.y,
		min: -100_000,
		step: 1,
	},
	{
		key: "transform.scaleX",
		label: "Escala X",
		type: "number",
		default: DEFAULTS.element.transform.scaleX,
		min: MIN_TRANSFORM_SCALE,
		step: 0.01,
	},
	{
		key: "transform.scaleY",
		label: "Escala Y",
		type: "number",
		default: DEFAULTS.element.transform.scaleY,
		min: MIN_TRANSFORM_SCALE,
		step: 0.01,
	},
	{
		key: "transform.rotate",
		label: "Rotação",
		type: "number",
		default: DEFAULTS.element.transform.rotate,
		min: -360,
		max: 360,
		step: 1,
	},
	{
		key: "transform.anchorX",
		label: "Âncora X",
		type: "number",
		default: DEFAULTS.element.transform.anchor.x,
		min: 0,
		max: 1,
		step: 0.01,
	},
	{
		key: "transform.anchorY",
		label: "Âncora Y",
		type: "number",
		default: DEFAULTS.element.transform.anchor.y,
		min: 0,
		max: 1,
		step: 0.01,
	},
	{
		key: "transform.flipHorizontal",
		label: "Espelhar horizontalmente",
		type: "boolean",
		default: DEFAULTS.element.transform.flipHorizontal,
		keyframable: false,
	},
	{
		key: "transform.flipVertical",
		label: "Espelhar verticalmente",
		type: "boolean",
		default: DEFAULTS.element.transform.flipVertical,
		keyframable: false,
	},
	{
		key: "opacity",
		label: "Opacidade",
		type: "number",
		default: DEFAULTS.element.opacity,
		min: 0,
		max: 1,
		step: 0.01,
	},
	{
		key: "blendMode",
		label: "Modo de mesclagem",
		type: "select",
		default: DEFAULTS.element.blendMode,
		keyframable: false,
		options: BLEND_MODE_OPTIONS,
	},
];

const audioElementParams: ElementParamDefinition[] = [
	{
		key: "volume",
		label: "Volume",
		type: "number",
		default: DEFAULTS.element.volume,
		min: VOLUME_DB_MIN,
		max: VOLUME_DB_MAX,
		step: 0.01,
	},
	{
		key: "muted",
		label: "Mudo",
		type: "boolean",
		default: false,
		keyframable: false,
	},
];

const textElementParams: ElementParamDefinition[] = [
	{
		key: "content",
		label: "Texto",
		type: "text",
		default: "Default text",
		keyframable: false,
	},
	{
		key: "fontFamily",
		label: "Fonte",
		type: "font",
		default: "Arial",
		keyframable: false,
	},
	{
		key: "fontSize",
		label: "Tamanho",
		type: "number",
		default: 15,
		min: 1,
		step: 1,
		uiSlider: { min: 8, max: 200 },
	},
	{
		key: "color",
		label: "Cor",
		type: "color",
		default: "#ffffff",
	},
	{
		key: "textAlign",
		label: "Alinhamento",
		type: "select",
		default: "center",
		keyframable: false,
		variant: "buttons",
		options: [
			{ value: "left", label: "Esquerda" },
			{ value: "center", label: "Centro" },
			{ value: "right", label: "Direita" },
		],
	},
	{
		key: "fontWeight",
		label: "Peso da fonte",
		type: "select",
		default: "normal",
		keyframable: false,
		options: [
			{ value: "normal", label: "Normal" },
			{ value: "bold", label: "Negrito" },
		],
	},
	{
		key: "fontStyle",
		label: "Estilo da fonte",
		type: "select",
		default: "normal",
		keyframable: false,
		options: [
			{ value: "normal", label: "Normal" },
			{ value: "italic", label: "Itálico" },
		],
	},
	{
		key: "textDecoration",
		label: "Decoração",
		type: "select",
		default: "none",
		keyframable: false,
		options: [
			{ value: "none", label: "Nenhuma" },
			{ value: "underline", label: "Sublinhado" },
			{ value: "line-through", label: "Tachado" },
		],
	},
	{
		key: "letterSpacing",
		label: "Espaçamento",
		type: "number",
		default: DEFAULTS.text.letterSpacing,
		min: -100,
		step: 0.1,
		uiSlider: { min: -20, max: 60 },
	},
	{
		key: "lineHeight",
		label: "Altura da linha",
		type: "number",
		default: DEFAULTS.text.lineHeight,
		min: 0.1,
		step: 0.1,
		uiSlider: { min: 0.5, max: 3 },
	},
	{
		key: "background.enabled",
		label: "Fundo ativado",
		type: "boolean",
		default: DEFAULTS.text.background.enabled,
		keyframable: false,
	},
	{
		key: "background.color",
		label: "Cor de fundo",
		type: "color",
		default: DEFAULTS.text.background.color,
		dependencies: [{ param: "background.enabled", equals: true }],
	},
	{
		key: "background.cornerRadius",
		label: "Raio do fundo",
		type: "number",
		default: DEFAULTS.text.background.cornerRadius,
		min: CORNER_RADIUS_MIN,
		max: CORNER_RADIUS_MAX,
		step: 1,
		dependencies: [{ param: "background.enabled", equals: true }],
	},
	{
		key: "background.paddingX",
		label: "Preenchimento X do fundo",
		type: "number",
		default: DEFAULTS.text.background.paddingX,
		min: 0,
		step: 1,
		dependencies: [{ param: "background.enabled", equals: true }],
	},
	{
		key: "background.paddingY",
		label: "Preenchimento Y do fundo",
		type: "number",
		default: DEFAULTS.text.background.paddingY,
		min: 0,
		step: 1,
		dependencies: [{ param: "background.enabled", equals: true }],
	},
	{
		key: "background.offsetX",
		label: "Deslocamento X do fundo",
		type: "number",
		default: DEFAULTS.text.background.offsetX,
		min: -100_000,
		step: 1,
		dependencies: [{ param: "background.enabled", equals: true }],
	},
	{
		key: "background.offsetY",
		label: "Deslocamento Y do fundo",
		type: "number",
		default: DEFAULTS.text.background.offsetY,
		min: -100_000,
		step: 1,
		dependencies: [{ param: "background.enabled", equals: true }],
	},
	{
		key: "stroke.enabled",
		label: "Contorno ativado",
		type: "boolean",
		default: DEFAULTS.text.stroke.enabled,
		keyframable: false,
	},
	{
		key: "stroke.color",
		label: "Cor do contorno",
		type: "color",
		default: DEFAULTS.text.stroke.color,
		dependencies: [{ param: "stroke.enabled", equals: true }],
	},
	{
		key: "stroke.width",
		label: "Espessura do contorno",
		type: "number",
		default: DEFAULTS.text.stroke.width,
		min: 0,
		max: 40,
		step: 1,
		uiSlider: { min: 0, max: 20 },
		dependencies: [{ param: "stroke.enabled", equals: true }],
	},
	{
		key: "shadow.enabled",
		label: "Sombra ativada",
		type: "boolean",
		default: DEFAULTS.text.shadow.enabled,
		keyframable: false,
	},
	{
		key: "wordHighlight.enabled",
		label: "Destaque por palavra ativado",
		type: "boolean",
		default: DEFAULTS.text.wordHighlight.enabled,
		keyframable: false,
	},
	{
		key: "wordHighlight.activeColor",
		label: "Cor de destaque",
		type: "color",
		default: DEFAULTS.text.wordHighlight.activeColor,
		dependencies: [{ param: "wordHighlight.enabled", equals: true }],
	},
	{
		key: "wordHighlight.activeScale",
		label: "Intensidade da animação",
		type: "number",
		default: DEFAULTS.text.wordHighlight.activeScale,
		min: 1,
		max: 2,
		step: 0.01,
		uiSlider: { min: 1, max: 1.6 },
		keyframable: false,
		dependencies: [{ param: "wordHighlight.enabled", equals: true }],
	},
	{
		key: "wordHighlight.animation",
		label: "Animação",
		type: "select",
		default: DEFAULTS.text.wordHighlight.animation,
		keyframable: false,
		options: [
			{ value: "none", label: "Nenhuma" },
			{ value: "pop", label: "Pop" },
			{ value: "bounce", label: "Bounce" },
			{ value: "punch", label: "Punch" },
		],
		dependencies: [{ param: "wordHighlight.enabled", equals: true }],
	},
	{
		key: "wordHighlight.background",
		label: "Caixa de fundo na palavra ativa",
		type: "boolean",
		default: DEFAULTS.text.wordHighlight.background,
		keyframable: false,
		dependencies: [{ param: "wordHighlight.enabled", equals: true }],
	},
	{
		key: "wordHighlight.backgroundColor",
		label: "Cor da caixa",
		type: "color",
		default: DEFAULTS.text.wordHighlight.backgroundColor,
		dependencies: [{ param: "wordHighlight.background", equals: true }],
	},
	{
		key: "wordHighlight.maxWordsPerLine",
		label: "Máx. de palavras por linha",
		type: "number",
		default: DEFAULTS.text.wordHighlight.maxWordsPerLine,
		min: 1,
		max: 12,
		step: 1,
		keyframable: false,
		dependencies: [{ param: "wordHighlight.enabled", equals: true }],
	},
	{
		key: "wordHighlight.uppercase",
		label: "Maiúsculas",
		type: "boolean",
		default: DEFAULTS.text.wordHighlight.uppercase,
		keyframable: false,
		dependencies: [{ param: "wordHighlight.enabled", equals: true }],
	},
];

const iq = INSTAGRAM_QUESTION_DEFAULTS;

const instagramQuestionElementParams: ElementParamDefinition[] = [
	{
		key: "header.content",
		label: "Cabeçalho",
		type: "text",
		default: iq.headerContent,
		keyframable: false,
	},
	{
		key: "question.content",
		label: "Pergunta",
		type: "text",
		default: iq.questionContent,
		keyframable: false,
	},
	{
		key: "fontFamily",
		label: "Fonte",
		type: "font",
		default: iq.fontFamily,
		keyframable: false,
	},
	{
		key: "question.fontWeight",
		label: "Peso da pergunta",
		type: "select",
		default: iq.questionFontWeight,
		keyframable: false,
		options: [
			{ value: "normal", label: "Normal" },
			{ value: "bold", label: "Negrito" },
		],
	},
	{
		key: "question.fontSize",
		label: "Tamanho",
		type: "number",
		default: iq.questionFontSize,
		min: 8,
		max: 300,
		step: 1,
		uiSlider: { min: 20, max: 100 },
		keyframable: false,
	},
	{
		key: "header.fontSize",
		label: "Cabeçalho (tamanho)",
		type: "number",
		default: iq.headerFontSize,
		min: 8,
		max: 200,
		step: 1,
		uiSlider: { min: 16, max: 80 },
		keyframable: false,
	},
	{
		key: "card.headerColor",
		label: "Cor do cabeçalho",
		type: "color",
		default: iq.headerBgColor,
		keyframable: false,
	},
	{
		key: "card.bodyColor",
		label: "Cor do corpo",
		type: "color",
		default: iq.bodyBgColor,
		keyframable: false,
	},
	{
		key: "question.color",
		label: "Cor da pergunta",
		type: "color",
		default: iq.questionColor,
		keyframable: false,
	},
	{
		key: "header.color",
		label: "Cor do texto superior",
		type: "color",
		default: iq.headerColor,
		keyframable: false,
	},
	{
		key: "card.cornerRadius",
		label: "Raio dos cantos",
		type: "number",
		default: iq.cornerRadius,
		min: 0,
		max: 80,
		step: 1,
		uiSlider: { min: 0, max: 60 },
		keyframable: false,
	},
	{
		key: "card.width",
		label: "Largura do card",
		type: "number",
		default: iq.cardWidth,
		keyframable: false,
		min: 200,
		max: 2000,
		step: 1,
		uiSlider: { min: 300, max: 1200 },
	},
	{
		key: "card.paddingX",
		label: "Preenchimento horizontal",
		type: "number",
		default: iq.paddingX,
		min: 0,
		max: 200,
		step: 1,
		keyframable: false,
	},
	{
		key: "card.headerPaddingY",
		label: "Preenchimento do cabeçalho",
		type: "number",
		default: iq.headerPaddingY,
		min: 0,
		max: 100,
		step: 1,
		keyframable: false,
	},
	{
		key: "card.bodyPaddingY",
		label: "Preenchimento do corpo",
		type: "number",
		default: iq.bodyPaddingY,
		min: 0,
		max: 200,
		step: 1,
		keyframable: false,
	},
	{
		key: "card.shadow",
		label: "Sombra",
		type: "boolean",
		default: iq.shadow,
		keyframable: false,
	},
];

export const elementParamRegistry = new DefinitionRegistry<
	ElementType,
	readonly ElementParamDefinition[]
>("element params");

elementParamRegistry.register({
	key: "video",
	definition: [...visualElementParams, ...audioElementParams],
});
elementParamRegistry.register({ key: "image", definition: visualElementParams });
elementParamRegistry.register({
	key: "text",
	definition: [...textElementParams, ...visualElementParams],
});
elementParamRegistry.register({
	key: "sticker",
	definition: visualElementParams,
});
elementParamRegistry.register({
	key: "graphic",
	definition: visualElementParams,
});
elementParamRegistry.register({
	key: "instagramQuestion",
	definition: [...instagramQuestionElementParams, ...visualElementParams],
});
elementParamRegistry.register({ key: "audio", definition: audioElementParams });
elementParamRegistry.register({ key: "effect", definition: [] });

export function getElementParams({
	element,
}: {
	element: TimelineElement;
}): readonly ElementParamDefinition[] {
	return elementParamRegistry.has(element.type)
		? elementParamRegistry.get(element.type)
		: [];
}

export function getBuiltInElementParams({
	type,
}: {
	type: ElementType;
}): readonly ElementParamDefinition[] {
	return elementParamRegistry.has(type) ? elementParamRegistry.get(type) : [];
}

export function getElementParam({
	element,
	key,
}: {
	element: TimelineElement;
	key: string;
}): ElementParamDefinition | null {
	return (
		getElementParams({ element }).find((param) => param.key === key) ?? null
	);
}

export function readElementParamValue({
	element,
	param,
}: {
	element: TimelineElement;
	param: ElementParamDefinition;
}): ParamValue | null {
	if (param.read) {
		return param.read({ element });
	}
	if ("params" in element) {
		return element.params[param.key] ?? param.default;
	}
	return null;
}

export function writeElementParamValue({
	element,
	param,
	value,
}: {
	element: TimelineElement;
	param: ElementParamDefinition;
	value: ParamValue;
}): TimelineElement {
	if (param.write) {
		return param.write({ element, value });
	}
	if ("params" in element) {
		return {
			...element,
			params: {
				...element.params,
				[param.key]: value,
			},
		};
	}
	return element;
}

export function buildElementParamValues({
	element,
}: {
	element: TimelineElement;
}): ParamValues {
	const values: ParamValues = {};
	for (const param of getElementParams({ element })) {
		const value = readElementParamValue({ element, param });
		if (value !== null) {
			values[param.key] = value;
		}
	}
	return values;
}

