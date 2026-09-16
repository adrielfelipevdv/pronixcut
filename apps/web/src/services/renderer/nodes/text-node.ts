import { BaseNode } from "./base-node";
import type { TextElement } from "@/timeline";
import type { EffectPass } from "@/effects/types";
import type { BlendMode, Transform } from "@/rendering";
import {
	drawMeasuredTextLayout,
	strokeMeasuredTextLayout,
} from "@/text/primitives";
import {
	drawWordHighlightedLayout,
	readWordHighlightStyleFromParams,
} from "@/text/word-highlight";
import type { MeasuredTextElement } from "@/text/measure-element";

export type TextNodeParams = TextElement & {
	transform: Transform;
	opacity: number;
	blendMode?: BlendMode;
	canvasCenter: { x: number; y: number };
	canvasHeight: number;
	textBaseline?: CanvasTextBaseline;
};

export interface ResolvedWordHighlightState {
	activeWordIndex: number;
	activeWordProgress: number;
}

export interface ResolvedTextNodeState {
	transform: Transform;
	opacity: number;
	textColor: string;
	backgroundColor: string;
	strokeEnabled: boolean;
	strokeColor: string;
	strokeWidth: number;
	effectPasses: EffectPass[][];
	measuredText: MeasuredTextElement;
	wordHighlight: ResolvedWordHighlightState | null;
}

export class TextNode extends BaseNode<TextNodeParams, ResolvedTextNodeState> {}

export function renderTextToContext({
	node,
	ctx,
}: {
	node: TextNode;
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}): void {
	const resolved = node.resolved;
	if (!resolved) {
		return;
	}

	const x = resolved.transform.position.x + node.params.canvasCenter.x;
	const y = resolved.transform.position.y + node.params.canvasCenter.y;
	const baseline = node.params.textBaseline ?? "middle";

	ctx.save();
	ctx.translate(x, y);
	ctx.scale(resolved.transform.scaleX, resolved.transform.scaleY);
	if (resolved.transform.rotate) {
		ctx.rotate((resolved.transform.rotate * Math.PI) / 180);
	}

	if (resolved.strokeEnabled) {
		strokeMeasuredTextLayout({
			ctx,
			layout: resolved.measuredText,
			strokeColor: resolved.strokeColor,
			strokeWidth: resolved.strokeWidth,
			textBaseline: baseline,
		});
	}

	if (resolved.wordHighlight && node.params.words && node.params.words.length > 0) {
		const style = readWordHighlightStyleFromParams({ params: node.params.params });
		drawWordHighlightedLayout({
			ctx,
			layout: resolved.measuredText,
			words: node.params.words,
			activeWordIndex: resolved.wordHighlight.activeWordIndex,
			activeWordProgress: resolved.wordHighlight.activeWordProgress,
			textColor: resolved.textColor,
			style,
			maxWordsPerLine: style.maxWordsPerLine,
			textBaseline: baseline,
		});
	} else {
		drawMeasuredTextLayout({
			ctx,
			layout: resolved.measuredText,
			textColor: resolved.textColor,
			background: resolved.measuredText.resolvedBackground,
			backgroundColor: resolved.backgroundColor,
			textBaseline: baseline,
		});
	}

	ctx.restore();
}
