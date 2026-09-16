"use client";

import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";
import { Switch } from "@/components/ui/switch";
import { Button } from "@/components/ui/button";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Link01Icon,
	Unlink01Icon,
	RefreshIcon,
	SparklesIcon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/utils/ui";
import type { NumberParamDefinition, ParamValue } from "@/params";
import type { VisualElement } from "@/timeline";
import { TRANSFORM_PRESETS } from "@/timeline/transform-presets";
import type { MediaTime } from "@/wasm";
import { useEditor } from "@/editor/use-editor";
import {
	EASING_PRESET_OPTIONS,
	buildEasingCurvePatches,
	getChannel,
	getEasingPresetForSegment,
	type EasingPresetId,
} from "@/animation";
import type { AnimationPath, ScalarAnimationKey } from "@/animation/types";
import { useElementPlayhead } from "@/components/editor/panels/properties/hooks/use-element-playhead";
import {
	useElementParamField,
	useSingleElementParamValue,
} from "./element-params-tab";
import { NumberParamControl } from "./property-param-field";
import { KeyframeToggle } from "./keyframe-toggle";
import { usePropertiesStore } from "../stores/properties-store";
import { DEFAULTS } from "@/timeline/defaults";

function toNumber(value: ParamValue): number {
	return typeof value === "number" ? value : Number(value);
}

function clampToRange({
	value,
	min,
	max,
}: {
	value: number;
	min: number;
	max: number;
}): number {
	return Math.min(max, Math.max(min, value));
}

type AxisField = {
	param: NumberParamDefinition;
	value: number;
	onPreview: (value: number) => void;
	onCommit: () => void;
	keyframe?: { isActive: boolean; isDisabled: boolean; onToggle: () => void };
};

/**
 * Compact "Ajustes" transform layout: Posição X/Y and Escala X/Y on one row
 * each (with an optional proportion lock for scale), Rotação/Opacidade as
 * sliders, Âncora X/Y, espelhamento, um seletor de interpolação por segmento
 * de keyframe, presets de transformação e um botão de reset — tudo reusando
 * os mesmos param definitions/keyframe wiring do loop genérico de params.
 */
export function TransformFields({
	element,
	trackId,
}: {
	element: VisualElement;
	trackId: string;
}) {
	const editor = useEditor();
	const { localTime, isPlayheadWithinElementRange } = useElementPlayhead({
		startTime: element.startTime,
		duration: element.duration,
	});

	const positionX = useAxisField({
		element,
		trackId,
		paramKey: "transform.positionX",
		localTime,
		isPlayheadWithinElementRange,
	});
	const positionY = useAxisField({
		element,
		trackId,
		paramKey: "transform.positionY",
		localTime,
		isPlayheadWithinElementRange,
	});
	const scaleX = useAxisField({
		element,
		trackId,
		paramKey: "transform.scaleX",
		localTime,
		isPlayheadWithinElementRange,
	});
	const scaleY = useAxisField({
		element,
		trackId,
		paramKey: "transform.scaleY",
		localTime,
		isPlayheadWithinElementRange,
	});
	const rotate = useAxisField({
		element,
		trackId,
		paramKey: "transform.rotate",
		localTime,
		isPlayheadWithinElementRange,
	});
	const anchorX = useAxisField({
		element,
		trackId,
		paramKey: "transform.anchorX",
		localTime,
		isPlayheadWithinElementRange,
	});
	const anchorY = useAxisField({
		element,
		trackId,
		paramKey: "transform.anchorY",
		localTime,
		isPlayheadWithinElementRange,
	});
	const opacityField = useAxisField({
		element,
		trackId,
		paramKey: "opacity",
		localTime,
		isPlayheadWithinElementRange,
	});

	const flipHorizontal = useSingleElementParamValue({
		element,
		key: "transform.flipHorizontal",
	});
	const flipVertical = useSingleElementParamValue({
		element,
		key: "transform.flipVertical",
	});

	const scaleLocked = usePropertiesStore((s) => s.isTransformScaleLocked);
	const setScaleLocked = usePropertiesStore((s) => s.setTransformScaleLocked);

	if (
		!positionX ||
		!positionY ||
		!scaleX ||
		!scaleY ||
		!rotate ||
		!anchorX ||
		!anchorY ||
		!opacityField
	)
		return null;

	const handleScaleXPreview = (value: number) => {
		scaleX.onPreview(value);
		if (scaleLocked) scaleY.onPreview(value);
	};
	const handleScaleXCommit = () => {
		scaleX.onCommit();
		if (scaleLocked) scaleY.onCommit();
	};
	const handleScaleYPreview = (value: number) => {
		scaleY.onPreview(value);
		if (scaleLocked) scaleX.onPreview(value);
	};
	const handleScaleYCommit = () => {
		scaleY.onCommit();
		if (scaleLocked) scaleX.onCommit();
	};

	const handleFlip = ({
		key,
		value,
	}: {
		key: "transform.flipHorizontal" | "transform.flipVertical";
		value: boolean;
	}) => {
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					patch: { params: { ...element.params, [key]: value } },
				},
			],
		});
	};

	const handleReset = () => {
		const nextParams = {
			...element.params,
			"transform.positionX": DEFAULTS.element.transform.position.x,
			"transform.positionY": DEFAULTS.element.transform.position.y,
			"transform.scaleX": DEFAULTS.element.transform.scaleX,
			"transform.scaleY": DEFAULTS.element.transform.scaleY,
			"transform.rotate": DEFAULTS.element.transform.rotate,
			"transform.anchorX": DEFAULTS.element.transform.anchor.x,
			"transform.anchorY": DEFAULTS.element.transform.anchor.y,
			"transform.flipHorizontal": DEFAULTS.element.transform.flipHorizontal,
			"transform.flipVertical": DEFAULTS.element.transform.flipVertical,
			opacity: DEFAULTS.element.opacity,
		};
		const nextAnimations = { ...element.animations };
		for (const path of RESETTABLE_ANIMATION_PATHS) {
			nextAnimations[path] = undefined;
		}
		editor.timeline.updateElements({
			updates: [
				{
					trackId,
					elementId: element.id,
					patch: { params: nextParams, animations: nextAnimations },
				},
			],
		});
	};

	const handlePreset = ({ presetId }: { presetId: string }) => {
		const preset = TRANSFORM_PRESETS.find((p) => p.id === presetId);
		if (!preset) return;
		const keyframes = preset.build({ duration: element.duration }).map((kf) => ({
			trackId,
			elementId: element.id,
			propertyPath: kf.propertyPath,
			time: kf.time,
			value: kf.value,
		}));
		editor.timeline.upsertKeyframes({ keyframes });
	};

	return (
		<div className="flex flex-col gap-3.5">
			<div className="flex items-center justify-between">
				<PresetsMenu onSelect={(presetId) => handlePreset({ presetId })} />
				<Button
					variant="ghost"
					size="sm"
					className="h-7 gap-1 px-2 text-xs text-muted-foreground hover:text-foreground"
					onClick={handleReset}
					title="Redefinir transformação"
				>
					<HugeiconsIcon icon={RefreshIcon} className="size-3.5" />
					Redefinir
				</Button>
			</div>

			<TransformRow label="Posição">
				<AxisNumberField axis="X" field={positionX} />
				<AxisNumberField axis="Y" field={positionY} />
				<SegmentEasingSelect
					element={element}
					trackId={trackId}
					propertyPath="transform.positionX"
					localTime={localTime}
				/>
			</TransformRow>

			<TransformRow
				label="Escala"
				trailing={
					<button
						type="button"
						aria-pressed={scaleLocked}
						title={
							scaleLocked
								? "Desativar proporção travada"
								: "Manter proporção"
						}
						onClick={() => setScaleLocked({ locked: !scaleLocked })}
						className={cn(
							"flex size-5 shrink-0 items-center justify-center rounded transition-colors duration-150",
							scaleLocked
								? "text-primary"
								: "text-muted-foreground hover:text-foreground",
						)}
					>
						<HugeiconsIcon
							icon={scaleLocked ? Link01Icon : Unlink01Icon}
							className="size-3.5"
						/>
					</button>
				}
			>
				<AxisNumberField
					axis="X"
					field={scaleX}
					onPreviewOverride={handleScaleXPreview}
					onCommitOverride={handleScaleXCommit}
				/>
				<AxisNumberField
					axis="Y"
					field={scaleY}
					onPreviewOverride={handleScaleYPreview}
					onCommitOverride={handleScaleYCommit}
				/>
				<SegmentEasingSelect
					element={element}
					trackId={trackId}
					propertyPath="transform.scaleX"
					localTime={localTime}
				/>
			</TransformRow>

			<SliderRow
				label="Rotação"
				field={rotate}
				min={-180}
				max={180}
				step={1}
				suffix="°"
				trailing={
					<SegmentEasingSelect
						element={element}
						trackId={trackId}
						propertyPath="transform.rotate"
						localTime={localTime}
					/>
				}
			/>

			<TransformRow label="Âncora">
				<AxisNumberField axis="X" field={anchorX} />
				<AxisNumberField axis="Y" field={anchorY} />
			</TransformRow>

			<SliderRow
				label="Opacidade"
				field={opacityField}
				min={0}
				max={1}
				step={0.01}
				displayMultiplier={100}
				suffix="%"
				trailing={
					<SegmentEasingSelect
						element={element}
						trackId={trackId}
						propertyPath="opacity"
						localTime={localTime}
					/>
				}
			/>

			{flipHorizontal && flipVertical && (
				<div className="flex flex-col gap-1.5">
					<FlipRow
						label="Espelhar horizontalmente"
						checked={Boolean(flipHorizontal.baseValue)}
						onCheckedChange={(checked) =>
							handleFlip({ key: "transform.flipHorizontal", value: checked })
						}
					/>
					<FlipRow
						label="Espelhar verticalmente"
						checked={Boolean(flipVertical.baseValue)}
						onCheckedChange={(checked) =>
							handleFlip({ key: "transform.flipVertical", value: checked })
						}
					/>
				</div>
			)}
		</div>
	);
}

function PresetsMenu({
	onSelect,
}: {
	onSelect: (presetId: string) => void;
}) {
	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button
					variant="outline"
					size="sm"
					className="h-7 gap-1 px-2 text-xs"
					title="Presets de transformação"
				>
					<HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
					Presets
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start">
				{TRANSFORM_PRESETS.map((preset) => (
					<DropdownMenuItem key={preset.id} onClick={() => onSelect(preset.id)}>
						{preset.name}
					</DropdownMenuItem>
				))}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}

function FlipRow({
	label,
	checked,
	onCheckedChange,
}: {
	label: string;
	checked: boolean;
	onCheckedChange: (checked: boolean) => void;
}) {
	return (
		<div className="flex items-center justify-between gap-2">
			<Label className="text-xs font-normal text-muted-foreground">
				{label}
			</Label>
			<Switch checked={checked} onCheckedChange={onCheckedChange} />
		</div>
	);
}

function TransformRow({
	label,
	trailing,
	children,
}: {
	label: string;
	trailing?: React.ReactNode;
	children: React.ReactNode;
}) {
	return (
		<div className="flex flex-col gap-1.5">
			<div className="flex h-4 items-center justify-between gap-1.5">
				<Label>{label}</Label>
				{trailing}
			</div>
			<div className="flex items-center gap-2">{children}</div>
		</div>
	);
}

function SliderRow({
	label,
	field,
	min,
	max,
	step,
	displayMultiplier = 1,
	suffix,
	trailing,
}: {
	label: string;
	field: AxisField;
	min: number;
	max: number;
	step: number;
	displayMultiplier?: number;
	suffix?: string;
	trailing?: React.ReactNode;
}) {
	const displayValue = clampToRange({
		value: field.value * displayMultiplier,
		min,
		max,
	});

	return (
		<TransformRow label={label} trailing={trailing}>
			<div className="flex flex-1 items-center gap-2">
				{field.keyframe && (
					<KeyframeToggle
						isActive={field.keyframe.isActive}
						isDisabled={field.keyframe.isDisabled}
						title={`Toggle ${label.toLowerCase()} keyframe`}
						onToggle={field.keyframe.onToggle}
					/>
				)}
				<Slider
					className="flex-1"
					min={min}
					max={max}
					step={step}
					value={[displayValue]}
					onValueChange={([next]) => {
						if (next === undefined) return;
						field.onPreview(next / displayMultiplier);
					}}
					onValueCommit={field.onCommit}
				/>
				<NumberParamControl
					param={field.param}
					value={field.value}
					onPreview={field.onPreview}
					onCommit={field.onCommit}
					className="w-[68px] shrink-0"
				/>
				{suffix && (
					<span className="w-3 shrink-0 text-[11px] text-muted-foreground">
						{suffix}
					</span>
				)}
			</div>
		</TransformRow>
	);
}

function AxisNumberField({
	axis,
	field,
	onPreviewOverride,
	onCommitOverride,
}: {
	axis: "X" | "Y";
	field: AxisField;
	onPreviewOverride?: (value: number) => void;
	onCommitOverride?: () => void;
}) {
	return (
		<div className="flex flex-1 items-center gap-1">
			{field.keyframe && (
				<KeyframeToggle
					isActive={field.keyframe.isActive}
					isDisabled={field.keyframe.isDisabled}
					title={`Toggle ${axis} keyframe`}
					onToggle={field.keyframe.onToggle}
				/>
			)}
			<NumberParamControl
				param={field.param}
				value={field.value}
				onPreview={onPreviewOverride ?? field.onPreview}
				onCommit={onCommitOverride ?? field.onCommit}
				icon={axis}
			/>
		</div>
	);
}

/**
 * Interpolation picker for the keyframe segment straddling the playhead on a
 * given property. Reuses the existing bezier/curve-handle machinery
 * (`updateKeyframeCurves`) — Linear/Ease In/Ease Out/Ease In-Out are just
 * named cubic-bezier presets, not a second animation engine. Renders nothing
 * until there are at least two keyframes on this path to actually shape a
 * segment between.
 */
function SegmentEasingSelect({
	element,
	trackId,
	propertyPath,
	localTime,
}: {
	element: VisualElement;
	trackId: string;
	propertyPath: AnimationPath;
	localTime: MediaTime;
}) {
	const editor = useEditor();
	const channel = getChannel({ animations: element.animations, propertyPath });
	const keys = channel && "keys" in channel ? (channel.keys as ScalarAnimationKey[]) : [];

	if (keys.length < 2) return null;

	const sorted = [...keys].sort((a, b) => a.time - b.time);
	let leftKey: ScalarAnimationKey | null = null;
	let rightKey: ScalarAnimationKey | null = null;
	for (let i = 0; i < sorted.length - 1; i++) {
		const candidateLeft = sorted[i];
		const candidateRight = sorted[i + 1];
		if (
			candidateLeft &&
			candidateRight &&
			localTime >= candidateLeft.time &&
			localTime <= candidateRight.time
		) {
			leftKey = candidateLeft;
			rightKey = candidateRight;
			break;
		}
	}
	if (!leftKey || !rightKey) return null;

	const currentPreset = getEasingPresetForSegment({ leftKey });

	return (
		<Select
			value={currentPreset ?? undefined}
			onValueChange={(next) => {
				const easing = next as EasingPresetId;
				if (!leftKey || !rightKey) return;
				const { leftKeyPatch, rightKeyPatch } = buildEasingCurvePatches({
					easing,
					leftKey,
					rightKey,
				});
				editor.timeline.updateKeyframeCurves({
					keyframes: [
						{
							trackId,
							elementId: element.id,
							propertyPath,
							componentKey: "value",
							keyframeId: leftKey.id,
							patch: leftKeyPatch,
						},
						{
							trackId,
							elementId: element.id,
							propertyPath,
							componentKey: "value",
							keyframeId: rightKey.id,
							patch: rightKeyPatch,
						},
					],
				});
			}}
		>
			<SelectTrigger className="h-5 w-20 gap-1 border-none bg-transparent px-1 text-[10px] text-muted-foreground shadow-none">
				<SelectValue placeholder="Curva" />
			</SelectTrigger>
			<SelectContent>
				{EASING_PRESET_OPTIONS.map((option) => (
					<SelectItem key={option.value} value={option.value}>
						{option.label}
					</SelectItem>
				))}
			</SelectContent>
		</Select>
	);
}

function useAxisField({
	element,
	trackId,
	paramKey,
	localTime,
	isPlayheadWithinElementRange,
}: {
	element: VisualElement;
	trackId: string;
	paramKey: string;
	localTime: MediaTime;
	isPlayheadWithinElementRange: boolean;
}): AxisField | null {
	const resolved = useSingleElementParamValue({ element, key: paramKey });
	const numberParam =
		resolved && resolved.param.type === "number" ? resolved.param : null;
	const field = useElementParamField({
		element,
		trackId,
		param: numberParam ?? NUMBER_FALLBACK_PARAM,
		baseValue: resolved?.baseValue ?? 0,
		localTime,
		isPlayheadWithinElementRange,
	});

	if (!numberParam) return null;

	return {
		param: numberParam,
		value: toNumber(field.value),
		onPreview: (value: number) => field.onPreview(value),
		onCommit: field.onCommit,
		keyframe: field.keyframe,
	};
}

// A single param key (transform.positionX/Y, transform.scaleX/Y,
// transform.rotate, transform.anchorX/Y, opacity) is always registered as a
// number param for every visual element type — this fallback only exists so
// the hook above can call useElementParamField unconditionally (rules of
// hooks) before it has confirmed that; it's never actually rendered from.
const NUMBER_FALLBACK_PARAM: NumberParamDefinition = {
	key: "__unused",
	label: "",
	type: "number",
	default: 0,
	min: 0,
	step: 1,
};

const RESETTABLE_ANIMATION_PATHS = [
	"transform.positionX",
	"transform.positionY",
	"transform.scaleX",
	"transform.scaleY",
	"transform.rotate",
	"transform.anchorX",
	"transform.anchorY",
	"opacity",
] as const;
