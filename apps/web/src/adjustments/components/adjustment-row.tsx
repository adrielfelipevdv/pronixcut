"use client";

import { useEffect, useState } from "react";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import { AdjustmentSlider } from "./adjustment-slider";
import type { AdjustmentRange } from "../types";
import { cn } from "@/utils/ui";

function formatValue({ value, decimals }: { value: number; decimals: number }) {
	return value.toFixed(decimals);
}

function parseValue({ raw, range }: { raw: string; range: AdjustmentRange }) {
	const parsed = Number.parseFloat(raw.replace(",", "."));
	if (Number.isNaN(parsed)) return null;
	const clamped = Math.min(range.max, Math.max(range.min, parsed));
	const snapped = Math.round(clamped / range.step) * range.step;
	return Number(snapped.toFixed(6));
}

export function AdjustmentRow({
	icon,
	label,
	value,
	range,
	onChange,
	onCommit,
	trackGradient,
	className,
}: {
	icon: IconSvgElement;
	label: string;
	value: number;
	range: AdjustmentRange;
	onChange: (value: number) => void;
	/** Fired once at the end of an interaction (slider pointer-up, or number input blur/Enter) — use to group a drag into a single undo step. Ignored by callers that don't need history grouping (e.g. the local-only Básico tab). */
	onCommit?: () => void;
	trackGradient?: string;
	className?: string;
}) {
	const [draft, setDraft] = useState(() =>
		formatValue({ value, decimals: range.decimals }),
	);

	useEffect(() => {
		setDraft(formatValue({ value, decimals: range.decimals }));
	}, [value, range.decimals]);

	const commitDraft = (raw: string) => {
		const parsed = parseValue({ raw, range });
		if (parsed === null) {
			setDraft(formatValue({ value, decimals: range.decimals }));
			return;
		}
		onChange(parsed);
		setDraft(formatValue({ value: parsed, decimals: range.decimals }));
		onCommit?.();
	};

	return (
		<div className={cn("flex flex-col gap-1.5", className)}>
			<div className="flex items-center gap-1.5">
				<HugeiconsIcon
					icon={icon}
					className="text-muted-foreground size-3.5 shrink-0"
				/>
				<span className="text-foreground truncate text-xs font-medium">
					{label}
				</span>
			</div>
			<div className="flex items-center gap-2">
				<AdjustmentSlider
					className="min-w-0 flex-1"
					value={value}
					min={range.min}
					max={range.max}
					step={range.step}
					trackGradient={trackGradient}
					label={label}
					onValueChange={onChange}
					onValueCommit={onCommit}
				/>
				<input
					value={draft}
					onChange={(event) => setDraft(event.target.value)}
					onBlur={(event) => commitDraft(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" || event.key === "Escape") {
							event.currentTarget.blur();
						}
					}}
					inputMode="decimal"
					aria-label={label}
					className="border-border bg-accent text-foreground focus-visible:border-primary h-7 w-14 shrink-0 rounded-md border px-1.5 text-center text-xs outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none"
				/>
			</div>
		</div>
	);
}
