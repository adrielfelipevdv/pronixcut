"use client";

import type {
	ParamDefinition,
	NumberParamDefinition,
	SelectParamDefinition,
	ParamValue,
} from "@/params";
import {
	formatNumberForDisplay,
	getFractionDigitsForStep,
	snapToStep,
	clamp,
} from "@/utils/math";
import { SectionField } from "@/components/section";
import { NumberField } from "@/components/ui/number-field";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { ColorPicker } from "@/components/ui/color-picker";
import { FontPicker } from "@/components/ui/font-picker";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { usePropertyDraft } from "../hooks/use-property-draft";
import { KeyframeToggle } from "./keyframe-toggle";
import { Textarea } from "@/components/ui/textarea";
import { HugeiconsIcon, type IconSvgElement } from "@hugeicons/react";
import {
	TextAlignLeftIcon,
	TextAlignCenterIcon,
	TextAlignRightIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/utils/ui";

const BUTTON_GROUP_ICONS: Record<string, IconSvgElement> = {
	left: TextAlignLeftIcon,
	center: TextAlignCenterIcon,
	right: TextAlignRightIcon,
};

export function PropertyParamField({
	param,
	value,
	onPreview,
	onCommit,
	keyframe,
	layout = "stack",
}: {
	param: ParamDefinition;
	value: ParamValue;
	onPreview: (value: ParamValue) => void;
	onCommit: () => void;
	keyframe?: {
		isActive: boolean;
		isDisabled: boolean;
		onToggle: () => void;
	};
	layout?: "stack" | "row";
}) {
	return (
		<SectionField
			label={param.label}
			layout={layout}
			beforeLabel={
				keyframe && param.keyframable !== false ? (
					<KeyframeToggle
						isActive={keyframe.isActive}
						isDisabled={keyframe.isDisabled}
						title={`Toggle ${param.label.toLowerCase()} keyframe`}
						onToggle={keyframe.onToggle}
					/>
				) : undefined
			}
		>
			<ParamInput
				param={param}
				value={value}
				onPreview={onPreview}
				onCommit={onCommit}
			/>
		</SectionField>
	);
}

function ParamInput({
	param,
	value,
	onPreview,
	onCommit,
}: {
	param: ParamDefinition;
	value: ParamValue;
	onPreview: (value: ParamValue) => void;
	onCommit: () => void;
}) {
	if (param.type === "number") {
		return (
			<NumberParamField
				param={param}
				value={typeof value === "number" ? value : Number(value)}
				onPreview={onPreview}
				onCommit={onCommit}
			/>
		);
	}

	if (param.type === "boolean") {
		return (
			<Switch
				checked={Boolean(value)}
				onCheckedChange={(checked) => {
					onPreview(checked);
					onCommit();
				}}
			/>
		);
	}

	if (param.type === "select") {
		if (param.variant === "buttons") {
			return (
				<ButtonGroupParamField
					param={param}
					value={String(value)}
					onPreview={onPreview}
					onCommit={onCommit}
				/>
			);
		}

		return (
			<Select
				value={String(value)}
				onValueChange={(selected) => {
					onPreview(selected);
					onCommit();
				}}
			>
				<SelectTrigger className="w-full">
					<SelectValue />
				</SelectTrigger>
				<SelectContent>
					{param.options.map((option) => (
						<SelectItem key={option.value} value={option.value}>
							{option.label}
						</SelectItem>
					))}
				</SelectContent>
			</Select>
		);
	}

	if (param.type === "color") {
		return (
			<ColorPicker
				value={String(value).replace(/^#/, "").toUpperCase()}
				onChange={(color) => onPreview(`#${color}`)}
				onChangeEnd={(color) => {
					onPreview(`#${color}`);
					onCommit();
				}}
			/>
		);
	}

	if (param.type === "text") {
		return (
			<Textarea
				value={String(value)}
				onChange={(event) => onPreview(event.currentTarget.value)}
				onBlur={onCommit}
			/>
		);
	}

	if (param.type === "font") {
		return (
			<FontPicker
				defaultValue={String(value)}
				onValueChange={(family) => {
					onPreview(family);
					onCommit();
				}}
			/>
		);
	}

	return null;
}

function ButtonGroupParamField({
	param,
	value,
	onPreview,
	onCommit,
}: {
	param: SelectParamDefinition;
	value: string;
	onPreview: (value: ParamValue) => void;
	onCommit: () => void;
}) {
	return (
		<div className="border-border bg-accent flex h-7 flex-1 items-center gap-0.5 rounded-md border p-0.5">
			{param.options.map((option) => {
				const active = option.value === value;
				const icon = BUTTON_GROUP_ICONS[option.value];
				return (
					<button
						key={option.value}
						type="button"
						title={option.label}
						aria-pressed={active}
						onClick={() => {
							onPreview(option.value);
							onCommit();
						}}
						className={cn(
							"flex h-6 flex-1 items-center justify-center rounded-[5px] border border-transparent transition-colors duration-150",
							active
								? "bg-primary/15 border-primary/30 text-primary"
								: "text-muted-foreground hover:bg-background/60 hover:text-foreground",
						)}
					>
						{icon ? (
							<HugeiconsIcon icon={icon} className="size-3.5" />
						) : (
							<span className="text-xs">{option.label}</span>
						)}
					</button>
				);
			})}
		</div>
	);
}

/** Raw number field bound to a param definition — reusable outside the generic per-field loop (e.g. compact transform rows). */
export function NumberParamControl({
	param,
	value,
	onPreview,
	onCommit,
	icon,
	className,
}: {
	param: NumberParamDefinition;
	value: number;
	onPreview: (value: number) => void;
	onCommit: () => void;
	icon?: React.ReactNode;
	className?: string;
}) {
	const { min, max, step, displayMultiplier = 1 } = param;
	const displayValue = value * displayMultiplier;
	const clampDisplayValue = (nextDisplayValue: number) =>
		Math.max(
			min,
			max !== undefined ? Math.min(max, nextDisplayValue) : nextDisplayValue,
		);

	const previewFromDisplay = (displayVal: number) => {
		const clamped = clampDisplayValue(
			snapToStep({ value: displayVal, step }),
		);
		onPreview(clamped / displayMultiplier);
	};

	const maxFractionDigits = getFractionDigitsForStep({ step });

	const draft = usePropertyDraft({
		displayValue: formatNumberForDisplay({
			value: displayValue,
			maxFractionDigits,
		}),
		parse: (input) => {
			const parsed = parseFloat(input);
			if (Number.isNaN(parsed)) return null;
			return clampDisplayValue(snapToStep({ value: parsed, step }));
		},
		onPreview: previewFromDisplay,
		onCommit,
	});

	const handleReset = () => {
		onPreview(param.default);
		onCommit();
	};

	return (
		<NumberField
			icon={icon ?? param.shortLabel}
			value={draft.displayValue}
			dragSensitivity="slow"
			isDefault={value === param.default}
			className={className}
			onFocus={draft.onFocus}
			onChange={draft.onChange}
			onBlur={draft.onBlur}
			onScrub={previewFromDisplay}
			onScrubEnd={onCommit}
			onReset={handleReset}
		/>
	);
}

function NumberParamField({
	param,
	value,
	onPreview,
	onCommit,
}: {
	param: NumberParamDefinition;
	value: number;
	onPreview: (value: number) => void;
	onCommit: () => void;
}) {
	if (!param.uiSlider) {
		return (
			<NumberParamControl
				param={param}
				value={value}
				onPreview={onPreview}
				onCommit={onCommit}
			/>
		);
	}

	const displayValue = value * (param.displayMultiplier ?? 1);
	const sliderValue = clamp({
		value: displayValue,
		min: param.uiSlider.min,
		max: param.uiSlider.max,
	});
	const { step, min, max, displayMultiplier = 1 } = param;
	const clampDisplayValue = (nextDisplayValue: number) =>
		Math.max(
			min,
			max !== undefined ? Math.min(max, nextDisplayValue) : nextDisplayValue,
		);

	return (
		<div className="flex flex-1 items-center gap-2">
			<Slider
				className="flex-1"
				min={param.uiSlider.min}
				max={param.uiSlider.max}
				step={step}
				value={[sliderValue]}
				onValueChange={([next]) => {
					if (next === undefined) return;
					const clamped = clampDisplayValue(snapToStep({ value: next, step }));
					onPreview(clamped / displayMultiplier);
				}}
				onValueCommit={onCommit}
			/>
			<NumberParamControl
				param={param}
				value={value}
				onPreview={onPreview}
				onCommit={onCommit}
				className="w-[68px] shrink-0"
			/>
		</div>
	);
}
