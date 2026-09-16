import { BaseNode } from "./base-node";
import type { InstagramQuestionElement } from "@/timeline";
import type { EffectPass } from "@/effects/types";
import type { BlendMode, Transform } from "@/rendering";
import type { MeasuredInstagramQuestionCard } from "@/stickers/instagram-question/card";

export type InstagramQuestionNodeParams = InstagramQuestionElement & {
	transform: Transform;
	opacity: number;
	blendMode?: BlendMode;
	canvasCenter: { x: number; y: number };
	canvasHeight: number;
};

export interface ResolvedInstagramQuestionNodeState {
	transform: Transform;
	opacity: number;
	headerBgColor: string;
	bodyBgColor: string;
	headerTextColor: string;
	questionTextColor: string;
	shadow: boolean;
	effectPasses: EffectPass[][];
	measured: MeasuredInstagramQuestionCard;
}

export class InstagramQuestionNode extends BaseNode<
	InstagramQuestionNodeParams,
	ResolvedInstagramQuestionNodeState
> {}

export function renderInstagramQuestionToContext({
	node,
	ctx,
}: {
	node: InstagramQuestionNode;
	ctx: CanvasRenderingContext2D | OffscreenCanvasRenderingContext2D;
}): void {
	const resolved = node.resolved;
	if (!resolved) {
		return;
	}

	const { measured } = resolved;
	const { rect } = measured;
	const x = resolved.transform.position.x + node.params.canvasCenter.x;
	const y = resolved.transform.position.y + node.params.canvasCenter.y;

	ctx.save();
	ctx.translate(x, y);
	ctx.scale(resolved.transform.scaleX, resolved.transform.scaleY);
	if (resolved.transform.rotate) {
		ctx.rotate((resolved.transform.rotate * Math.PI) / 180);
	}

	// Body (full card) — drawn first so the header sits visually "inside" it
	// with no seam, matching a single rounded shape split into two fills.
	if (resolved.shadow) {
		ctx.save();
		ctx.shadowColor = "rgba(0, 0, 0, 0.15)";
		ctx.shadowBlur = 12 * measured.scale;
		ctx.shadowOffsetY = 4 * measured.scale;
	}
	const bodyPath = new Path2D();
	bodyPath.roundRect(rect.left, rect.top, rect.width, rect.height, measured.cornerRadiusPx);
	ctx.fillStyle = resolved.bodyBgColor;
	ctx.fill(bodyPath);
	if (resolved.shadow) {
		ctx.restore();
	}

	// Header — rounded only at the top, flush with the card's top corners.
	const headerPath = new Path2D();
	headerPath.roundRect(rect.left, rect.top, rect.width, measured.headerHeight, [
		measured.cornerRadiusPx,
		measured.cornerRadiusPx,
		0,
		0,
	]);
	ctx.fillStyle = resolved.headerBgColor;
	ctx.fill(headerPath);

	ctx.textAlign = "center";
	ctx.textBaseline = "middle";

	ctx.font = measured.headerFontString;
	ctx.fillStyle = resolved.headerTextColor;
	const headerBlockHeight = measured.headerLines.length * measured.headerLineHeightPx;
	const headerBlockTop = rect.top + (measured.headerHeight - headerBlockHeight) / 2;
	measured.headerLines.forEach((line, index) => {
		const lineY = headerBlockTop + index * measured.headerLineHeightPx + measured.headerLineHeightPx / 2;
		ctx.fillText(line, 0, lineY);
	});

	ctx.font = measured.questionFontString;
	ctx.fillStyle = resolved.questionTextColor;
	const bodyTop = rect.top + measured.headerHeight;
	const questionBlockHeight = measured.questionLines.length * measured.questionLineHeightPx;
	const questionBlockTop = bodyTop + (measured.bodyHeight - questionBlockHeight) / 2;
	measured.questionLines.forEach((line, index) => {
		const lineY =
			questionBlockTop + index * measured.questionLineHeightPx + measured.questionLineHeightPx / 2;
		ctx.fillText(line, 0, lineY);
	});

	ctx.restore();
}
