"use client";

import { useEffect, useRef } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Cancel01Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";

// Read-only 16:9 "reframe" mirror of the real preview canvas — never a
// second render pass. Every frame it just copies the pixels the real
// CanvasRenderer already drew (a center-crop, full width, cropped height —
// what a vertical composition looks like windowed into a widescreen frame)
// so it can never drift from what's actually being edited/exported, and
// carries zero cost to the renderer, playback, or export pipeline.
export function SidePreviewPane({
	sourceCanvas,
	onClose,
}: {
	sourceCanvas: HTMLCanvasElement | null;
	onClose: () => void;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const target = canvasRef.current;
		if (!target || !sourceCanvas) return;

		const ctx = target.getContext("2d");
		if (!ctx) return;

		let rafId: number;

		const draw = () => {
			rafId = requestAnimationFrame(draw);

			const sourceWidth = sourceCanvas.width;
			const sourceHeight = sourceCanvas.height;
			if (sourceWidth <= 0 || sourceHeight <= 0) return;

			// Center-crop the source down to a 16:9 slice. For a taller-than-wide
			// (vertical) source this keeps full width and crops top/bottom; for a
			// wider-than-16:9 source it keeps full height and crops the sides.
			const sourceAspect = sourceWidth / sourceHeight;
			const targetAspect = 16 / 9;

			let cropWidth = sourceWidth;
			let cropHeight = sourceHeight;
			if (sourceAspect > targetAspect) {
				cropWidth = sourceHeight * targetAspect;
			} else {
				cropHeight = sourceWidth / targetAspect;
			}
			const cropX = (sourceWidth - cropWidth) / 2;
			const cropY = (sourceHeight - cropHeight) / 2;

			if (
				target.width !== target.clientWidth ||
				target.height !== target.clientHeight
			) {
				target.width = target.clientWidth;
				target.height = target.clientHeight;
			}

			ctx.clearRect(0, 0, target.width, target.height);
			ctx.drawImage(
				sourceCanvas,
				cropX,
				cropY,
				cropWidth,
				cropHeight,
				0,
				0,
				target.width,
				target.height,
			);
		};

		rafId = requestAnimationFrame(draw);
		return () => cancelAnimationFrame(rafId);
	}, [sourceCanvas]);

	return (
		<div className="border-border bg-app flex h-full min-w-0 flex-1 flex-col overflow-hidden rounded-[10px] border">
			<div className="border-border text-muted-foreground flex h-9 shrink-0 items-center justify-between border-b px-3 text-[11px] font-medium">
				<span>Prévia 16:9</span>
				<Button
					variant="text"
					size="icon"
					className="size-5"
					onClick={onClose}
					title="Fechar prévia 16:9"
				>
					<HugeiconsIcon icon={Cancel01Icon} className="size-3.5" />
				</Button>
			</div>
			<div className="flex min-h-0 flex-1 items-center justify-center p-2">
				<div className="flex aspect-video max-h-full max-w-full items-center justify-center overflow-hidden rounded-md bg-black">
					<canvas ref={canvasRef} className="size-full" />
				</div>
			</div>
		</div>
	);
}
