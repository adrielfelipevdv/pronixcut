"use client";

import { Slider as SliderPrimitive } from "radix-ui";
import { cn } from "@/utils/ui";

interface AdjustmentSliderProps {
	value: number;
	min: number;
	max: number;
	step: number;
	onValueChange: (value: number) => void;
	onValueCommit?: () => void;
	className?: string;
	/** Gradient CSS for the track background — used for Temperatura/Matiz. */
	trackGradient?: string;
	label?: string;
}

// Fills from the zero point outward instead of from the left edge, so a
// bipolar range (e.g. -100..100) reads as "centered at zero" per the
// Ajustes mockup, rather than always filling from the track's minimum.
export function AdjustmentSlider({
	value,
	min,
	max,
	step,
	onValueChange,
	onValueCommit,
	className,
	trackGradient,
	label,
}: AdjustmentSliderProps) {
	const isBipolar = min < 0 && max > 0;
	const zeroPercent = isBipolar ? ((0 - min) / (max - min)) * 100 : 0;
	const valuePercent = ((value - min) / (max - min)) * 100;
	const fillLeft = isBipolar ? Math.min(zeroPercent, valuePercent) : 0;
	const fillWidth = isBipolar
		? Math.abs(valuePercent - zeroPercent)
		: valuePercent;

	return (
		<SliderPrimitive.Root
			className={cn(
				"relative flex w-full touch-none items-center select-none",
				className,
			)}
			min={min}
			max={max}
			step={step}
			value={[value]}
			onValueChange={([next]) => {
				if (next === undefined) return;
				onValueChange(next);
			}}
			onValueCommit={onValueCommit}
		>
			<SliderPrimitive.Track
				className="bg-accent relative h-1.5 w-full grow overflow-hidden rounded-full"
				style={trackGradient ? { background: trackGradient } : undefined}
			>
				{!trackGradient && (
					<div
						className="bg-primary absolute h-full rounded-full"
						style={{ left: `${fillLeft}%`, width: `${fillWidth}%` }}
					/>
				)}
				{isBipolar && (
					<div
						className="bg-foreground/25 absolute top-0 h-full w-px"
						style={{ left: `${zeroPercent}%` }}
					/>
				)}
			</SliderPrimitive.Track>
			<SliderPrimitive.Thumb
				aria-label={label}
				className="border-primary bg-white focus-visible:ring-ring block size-3.5 shrink-0 rounded-full border-2 shadow-sm transition-transform focus-visible:ring-1 focus-visible:outline-hidden hover:scale-110"
			/>
		</SliderPrimitive.Root>
	);
}
