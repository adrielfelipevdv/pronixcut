// Layout/measurement for the "Caixinha de perguntas" sticker (Instagram-style
// question box). Modeled after text/measure-element.ts + text/primitives.ts,
// but for two independently-styled text blocks stacked inside a rounded card
// whose height auto-grows with content and whose width wraps text (unlike the
// generic text element, which only breaks on explicit "\n").

import { buildTextFontString } from "@/text/primitives";
import type { TextCanvasContext } from "@/text/layout";
import type { ParamValues } from "@/params";

/** Design-space reference height. Every size param (font sizes, card width,
 * paddings, corner radius) is authored in "px at this canvas height" and
 * scaled proportionally to the project's real canvas height at render time —
 * the same trick text uses via FONT_SIZE_SCALE_REFERENCE, so the card stays
 * crisp and proportionally identical at 720p/1080p/4K. */
export const INSTAGRAM_QUESTION_REFERENCE_HEIGHT = 1080;

export const INSTAGRAM_QUESTION_DEFAULTS = {
	headerContent: "Consultoria gratuita \u{1F447}",
	headerFontSize: 34,
	headerColor: "#FFFFFF",
	questionContent: "Ainda vale a pena vender no Mercado Livre em 2026?",
	questionFontSize: 46,
	questionColor: "#111111",
	questionFontWeight: "bold" as const,
	fontFamily: "Inter",
	cardWidth: 640,
	headerBgColor: "#25282A",
	bodyBgColor: "#FFFFFF",
	cornerRadius: 28,
	paddingX: 28,
	headerPaddingY: 14,
	bodyPaddingY: 30,
	shadow: true,
};

const LINE_HEIGHT_RATIO = 1.25;

export interface InstagramQuestionCardStyle {
	headerContent: string;
	headerFontSize: number;
	headerColor: string;
	questionContent: string;
	questionFontSize: number;
	questionColor: string;
	questionFontWeight: "normal" | "bold";
	fontFamily: string;
	cardWidth: number;
	headerBgColor: string;
	bodyBgColor: string;
	cornerRadius: number;
	paddingX: number;
	headerPaddingY: number;
	bodyPaddingY: number;
	shadow: boolean;
}

export interface MeasuredInstagramQuestionCard {
	/** Local rect centered on the element's own origin (0,0), matching text's
	 * `visualRect` convention — left/top are negative-of-half-extent. */
	rect: { left: number; top: number; width: number; height: number };
	headerHeight: number;
	bodyHeight: number;
	cornerRadiusPx: number;
	headerLines: string[];
	questionLines: string[];
	headerFontString: string;
	questionFontString: string;
	headerLineHeightPx: number;
	questionLineHeightPx: number;
	headerPaddingYPx: number;
	bodyPaddingYPx: number;
	scale: number;
}

function readString({
	params,
	key,
	fallback,
}: {
	params: ParamValues;
	key: string;
	fallback: string;
}): string {
	const value = params[key];
	return typeof value === "string" ? value : fallback;
}

function readNumber({
	params,
	key,
	fallback,
}: {
	params: ParamValues;
	key: string;
	fallback: number;
}): number {
	const value = params[key];
	return typeof value === "number" ? value : fallback;
}

function readBoolean({
	params,
	key,
	fallback,
}: {
	params: ParamValues;
	key: string;
	fallback: boolean;
}): boolean {
	const value = params[key];
	return typeof value === "boolean" ? value : fallback;
}

export function buildInstagramQuestionStyleFromParams({
	params,
}: {
	params: ParamValues;
}): InstagramQuestionCardStyle {
	const d = INSTAGRAM_QUESTION_DEFAULTS;
	const questionFontWeight = params["question.fontWeight"];
	return {
		headerContent: readString({ params, key: "header.content", fallback: d.headerContent }),
		headerFontSize: readNumber({ params, key: "header.fontSize", fallback: d.headerFontSize }),
		headerColor: readString({ params, key: "header.color", fallback: d.headerColor }),
		questionContent: readString({ params, key: "question.content", fallback: d.questionContent }),
		questionFontSize: readNumber({ params, key: "question.fontSize", fallback: d.questionFontSize }),
		questionColor: readString({ params, key: "question.color", fallback: d.questionColor }),
		questionFontWeight: questionFontWeight === "normal" ? "normal" : d.questionFontWeight,
		fontFamily: readString({ params, key: "fontFamily", fallback: d.fontFamily }),
		cardWidth: readNumber({ params, key: "card.width", fallback: d.cardWidth }),
		headerBgColor: readString({ params, key: "card.headerColor", fallback: d.headerBgColor }),
		bodyBgColor: readString({ params, key: "card.bodyColor", fallback: d.bodyBgColor }),
		cornerRadius: readNumber({ params, key: "card.cornerRadius", fallback: d.cornerRadius }),
		paddingX: readNumber({ params, key: "card.paddingX", fallback: d.paddingX }),
		headerPaddingY: readNumber({ params, key: "card.headerPaddingY", fallback: d.headerPaddingY }),
		bodyPaddingY: readNumber({ params, key: "card.bodyPaddingY", fallback: d.bodyPaddingY }),
		shadow: readBoolean({ params, key: "card.shadow", fallback: d.shadow }),
	};
}

/** Greedy word-wrap to a max pixel width. Respects explicit "\n" breaks
 * first (each paragraph wraps independently), same as a user pressing Enter.
 * A single word wider than maxWidth is kept whole rather than broken mid-word. */
export function wrapTextToWidth({
	ctx,
	text,
	maxWidth,
}: {
	ctx: TextCanvasContext;
	text: string;
	maxWidth: number;
}): string[] {
	const paragraphs = text.split("\n");
	const lines: string[] = [];

	for (const paragraph of paragraphs) {
		const words = paragraph.split(/\s+/).filter((w) => w.length > 0);
		if (words.length === 0) {
			lines.push("");
			continue;
		}

		let current = words[0];
		for (let i = 1; i < words.length; i++) {
			const candidate = `${current} ${words[i]}`;
			if (ctx.measureText(candidate).width <= maxWidth) {
				current = candidate;
			} else {
				lines.push(current);
				current = words[i];
			}
		}
		lines.push(current);
	}

	return lines;
}

export function measureInstagramQuestionCard({
	style,
	canvasHeight,
	ctx,
}: {
	style: InstagramQuestionCardStyle;
	canvasHeight: number;
	ctx: TextCanvasContext;
}): MeasuredInstagramQuestionCard {
	const scale = canvasHeight / INSTAGRAM_QUESTION_REFERENCE_HEIGHT;

	const cardWidthPx = style.cardWidth * scale;
	const paddingXPx = style.paddingX * scale;
	const headerPaddingYPx = style.headerPaddingY * scale;
	const bodyPaddingYPx = style.bodyPaddingY * scale;
	const cornerRadiusPx = Math.max(0, style.cornerRadius * scale);

	const headerFontPx = Math.max(1, style.headerFontSize * scale);
	const questionFontPx = Math.max(1, style.questionFontSize * scale);
	const headerLineHeightPx = headerFontPx * LINE_HEIGHT_RATIO;
	const questionLineHeightPx = questionFontPx * LINE_HEIGHT_RATIO;

	const headerFontString = buildTextFontString({
		fontFamily: style.fontFamily,
		fontWeight: "normal",
		fontStyle: "normal",
		scaledFontSize: headerFontPx,
	});
	const questionFontString = buildTextFontString({
		fontFamily: style.fontFamily,
		fontWeight: style.questionFontWeight,
		fontStyle: "normal",
		scaledFontSize: questionFontPx,
	});

	const maxTextWidth = Math.max(1, cardWidthPx - paddingXPx * 2);

	ctx.save();
	ctx.font = headerFontString;
	const headerLines = wrapTextToWidth({
		ctx,
		text: style.headerContent,
		maxWidth: maxTextWidth,
	});
	ctx.font = questionFontString;
	const questionLines = wrapTextToWidth({
		ctx,
		text: style.questionContent,
		maxWidth: maxTextWidth,
	});
	ctx.restore();

	const headerHeight = headerLines.length * headerLineHeightPx + headerPaddingYPx * 2;
	const bodyHeight = questionLines.length * questionLineHeightPx + bodyPaddingYPx * 2;
	const totalHeight = headerHeight + bodyHeight;

	return {
		rect: {
			left: -cardWidthPx / 2,
			top: -totalHeight / 2,
			width: cardWidthPx,
			height: totalHeight,
		},
		headerHeight,
		bodyHeight,
		cornerRadiusPx,
		headerLines,
		questionLines,
		headerFontString,
		questionFontString,
		headerLineHeightPx,
		questionLineHeightPx,
		headerPaddingYPx,
		bodyPaddingYPx,
		scale,
	};
}
