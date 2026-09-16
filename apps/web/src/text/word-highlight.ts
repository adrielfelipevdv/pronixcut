import type { TextCanvasContext } from "@/text/layout";
import { DEFAULTS } from "@/timeline/defaults";
import type { ParamValues } from "@/params";
import { setCanvasLetterSpacing } from "./layout";
import type { MeasuredTextLayout } from "./primitives";

export interface WordTiming {
	text: string;
	/** Local time (same units/origin as the element's local playback time). */
	start: number;
	end: number;
}

export type WordHighlightAnimation = "none" | "pop" | "bounce" | "punch";

export interface WordHighlightStyle {
	enabled: boolean;
	activeColor: string;
	activeScale: number;
	background: boolean;
	backgroundColor: string;
	animation: WordHighlightAnimation;
	maxWordsPerLine: number;
	uppercase: boolean;
}

function isWordHighlightAnimation(value: unknown): value is WordHighlightAnimation {
	return (
		value === "none" || value === "pop" || value === "bounce" || value === "punch"
	);
}

/** Reads the resolved word-highlight style out of an element's flat params — the single source of truth both the renderer and any UI preview read from. */
export function readWordHighlightStyleFromParams({
	params,
}: {
	params: ParamValues;
}): WordHighlightStyle {
	const d = DEFAULTS.text.wordHighlight;
	return {
		enabled: typeof params["wordHighlight.enabled"] === "boolean"
			? (params["wordHighlight.enabled"] as boolean)
			: d.enabled,
		activeColor: typeof params["wordHighlight.activeColor"] === "string"
			? (params["wordHighlight.activeColor"] as string)
			: d.activeColor,
		activeScale: typeof params["wordHighlight.activeScale"] === "number"
			? (params["wordHighlight.activeScale"] as number)
			: d.activeScale,
		background: typeof params["wordHighlight.background"] === "boolean"
			? (params["wordHighlight.background"] as boolean)
			: d.background,
		backgroundColor: typeof params["wordHighlight.backgroundColor"] === "string"
			? (params["wordHighlight.backgroundColor"] as string)
			: d.backgroundColor,
		animation: isWordHighlightAnimation(params["wordHighlight.animation"])
			? params["wordHighlight.animation"]
			: d.animation,
		maxWordsPerLine: typeof params["wordHighlight.maxWordsPerLine"] === "number"
			? (params["wordHighlight.maxWordsPerLine"] as number)
			: d.maxWordsPerLine,
		uppercase: typeof params["wordHighlight.uppercase"] === "boolean"
			? (params["wordHighlight.uppercase"] as boolean)
			: d.uppercase,
	};
}

/** Finds which word (if any) is active at `localTime`. -1 when none is (before/after all words, or a gap between them). */
export function computeActiveWordIndex({
	words,
	localTime,
}: {
	words: readonly WordTiming[];
	localTime: number;
}): number {
	for (let i = 0; i < words.length; i++) {
		const word = words[i];
		if (word && localTime >= word.start && localTime < word.end) {
			return i;
		}
	}
	return -1;
}

/** Groups words into lines of at most `maxWordsPerLine` words each — a plain fixed-size chunking, applied consistently by both content-building and drawing so word-to-position correspondence never drifts. */
export function groupWordsIntoLines({
	words,
	maxWordsPerLine,
}: {
	words: readonly WordTiming[];
	maxWordsPerLine: number;
}): WordTiming[][] {
	const size = Math.max(1, Math.floor(maxWordsPerLine));
	const lines: WordTiming[][] = [];
	for (let i = 0; i < words.length; i += size) {
		lines.push(words.slice(i, i + size));
	}
	return lines.length > 0 ? lines : [[]];
}

/** Builds the `\n`-joined plain text a word-highlight caption should measure/lay out as — kept in sync with `groupWordsIntoLines` so the block's overall size (used for background/position) matches what actually gets drawn. */
export function buildWordHighlightContent({
	words,
	maxWordsPerLine,
	uppercase,
}: {
	words: readonly WordTiming[];
	maxWordsPerLine: number;
	uppercase: boolean;
}): string {
	const lines = groupWordsIntoLines({ words, maxWordsPerLine });
	return lines
		.map((line) =>
			line
				.map((word) => (uppercase ? word.text.toUpperCase() : word.text))
				.join(" "),
		)
		.join("\n");
}

function applyWordAnimationScale({
	animation,
	activeScale,
	progress,
}: {
	animation: WordHighlightAnimation;
	activeScale: number;
	/** 0..1 through the active word's own [start,end) window. */
	progress: number;
}): number {
	if (animation === "none") return activeScale;
	// "punch"/"pop"/"bounce" all read the same here: scale spikes right at the
	// word's own onset and eases back to 1 across the first third of its
	// window, rather than staying pinned at activeScale for the whole word —
	// that's what actually reads as a punchy per-word beat instead of a
	// static "this word is just bigger" state.
	const attackWindow = 0.35;
	if (progress >= attackWindow) return 1;
	const attackProgress = progress / attackWindow;
	const eased = 1 - (1 - attackProgress) * (1 - attackProgress);
	return 1 + (activeScale - 1) * (1 - eased);
}

export function drawWordHighlightedLayout({
	ctx,
	layout,
	words,
	activeWordIndex,
	activeWordProgress,
	textColor,
	style,
	maxWordsPerLine,
	textBaseline = "middle",
}: {
	ctx: TextCanvasContext;
	layout: MeasuredTextLayout;
	words: readonly WordTiming[];
	activeWordIndex: number;
	/** 0..1 progress through the active word's own window; ignored when `activeWordIndex` is -1. */
	activeWordProgress: number;
	textColor: string;
	style: WordHighlightStyle;
	maxWordsPerLine: number;
	textBaseline?: CanvasTextBaseline;
}): void {
	const lines = groupWordsIntoLines({ words, maxWordsPerLine });
	ctx.font = layout.fontString;
	ctx.textBaseline = textBaseline;
	setCanvasLetterSpacing({ ctx, letterSpacingPx: layout.letterSpacing });

	let globalWordIndex = 0;
	for (let lineIndex = 0; lineIndex < lines.length; lineIndex++) {
		const line = lines[lineIndex];
		if (!line) continue;
		const lineY = lineIndex * layout.lineHeightPx - layout.block.visualCenterOffset;
		const displayWords = line.map((word) =>
			style.uppercase ? word.text.toUpperCase() : word.text,
		);

		ctx.textAlign = "left";
		const spaceWidth = ctx.measureText(" ").width;
		const wordWidths = displayWords.map((text) => ctx.measureText(text).width);
		const lineWidth =
			wordWidths.reduce((sum, w) => sum + w, 0) +
			spaceWidth * Math.max(0, displayWords.length - 1);

		let cursorX =
			layout.textAlign === "center"
				? -lineWidth / 2
				: layout.textAlign === "right"
					? -lineWidth
					: 0;

		for (let i = 0; i < displayWords.length; i++) {
			const text = displayWords[i] ?? "";
			const width = wordWidths[i] ?? 0;
			const isActive = globalWordIndex === activeWordIndex;
			const wordCenterX = cursorX + width / 2;

			if (isActive && style.background && width > 0) {
				const paddingX = width * 0.18;
				const paddingY = layout.scaledFontSize * 0.18;
				ctx.save();
				ctx.fillStyle = style.backgroundColor;
				ctx.beginPath();
				ctx.roundRect(
					wordCenterX - width / 2 - paddingX,
					lineY - layout.scaledFontSize / 2 - paddingY,
					width + paddingX * 2,
					layout.scaledFontSize + paddingY * 2,
					layout.scaledFontSize * 0.15,
				);
				ctx.fill();
				ctx.restore();
			}

			ctx.save();
			ctx.fillStyle = isActive ? style.activeColor : textColor;
			if (isActive && width > 0) {
				const scale = applyWordAnimationScale({
					animation: style.animation,
					activeScale: style.activeScale,
					progress: activeWordProgress,
				});
				ctx.translate(wordCenterX, lineY);
				ctx.scale(scale, scale);
				ctx.textAlign = "center";
				ctx.fillText(text, 0, 0);
			} else {
				ctx.textAlign = "left";
				ctx.fillText(text, cursorX, lineY);
			}
			ctx.restore();

			cursorX += width + spaceWidth;
			globalWordIndex++;
		}
	}
}
