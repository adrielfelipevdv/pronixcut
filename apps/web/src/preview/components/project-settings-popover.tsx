"use client";

import { useState } from "react";
import { HugeiconsIcon } from "@hugeicons/react";
import { Settings02Icon } from "@hugeicons/core-free-icons";
import { Button } from "@/components/ui/button";
import {
	Popover,
	PopoverContent,
	PopoverTrigger,
} from "@/components/ui/popover";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { NumberField } from "@/components/ui/number-field";
import { FPS_PRESETS } from "@/fps/presets";
import { floatToFrameRate, frameRateToFloat } from "@/fps/utils";
import { useEditor } from "@/editor/use-editor";
import { useEditorStore } from "@/editor/editor-store";
import { usePropertyDraft } from "@/components/editor/panels/properties/hooks/use-property-draft";
import { dimensionToAspectRatio } from "@/utils/geometry";
import { formatNumberForDisplay } from "@/utils/math";
import type { TCanvasSize } from "@/project/types";
import { usePreviewStore } from "@/preview/preview-store";
import { PREVIEW_RESOLUTION_SCALE_OPTIONS } from "@/preview/preview-resolution-scale";

const ASPECT_RATIO_LABELS: Record<string, string> = {
	"16:9": "16:9",
	"9:16": "9:16",
	"1:1": "1:1",
	"4:5": "4:5",
	"4:3": "4:3",
};

const CUSTOM_VALUE = "custom";

function areCanvasSizesEqual({
	left,
	right,
}: {
	left: TCanvasSize;
	right: TCanvasSize;
}) {
	return left.width === right.width && left.height === right.height;
}

function formatCanvasDimension({ value }: { value: number }) {
	return formatNumberForDisplay({ value, maxFractionDigits: 0 });
}

function parseCanvasDimension({ input }: { input: string }): number | null {
	const trimmed = input.trim();
	if (!trimmed) return null;
	const parsed = Number(trimmed);
	if (!Number.isFinite(parsed)) return null;
	const rounded = Math.round(parsed);
	return rounded > 0 ? rounded : null;
}

function useCanvasDimensionDraft({
	value,
	onCommit,
}: {
	value: number;
	onCommit: (value: number) => void;
}) {
	const [pendingValue, setPendingValue] = useState(value);

	return usePropertyDraft({
		displayValue: formatCanvasDimension({ value }),
		parse: (input) => parseCanvasDimension({ input }),
		onStartEditing: () => setPendingValue(value),
		onPreview: (nextValue) => setPendingValue(nextValue),
		onCommit: () => {
			if (pendingValue !== value) onCommit(pendingValue);
		},
	});
}

// Project-level settings that used to live in their own "Configurações"
// sidebar tab — frame rate and aspect ratio directly affect the canvas
// you're looking at, so they now live one click away from the preview
// itself instead of a whole separate tool tab.
export function ProjectSettingsPopover() {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActive());
	const { canvasPresets } = useEditorStore();
	const previewResolutionScale = usePreviewStore((s) => s.previewResolutionScale);
	const setPreviewResolutionScale = usePreviewStore(
		(s) => s.setPreviewResolutionScale,
	);

	const currentCanvasSize = activeProject.settings.canvasSize;
	const canvasSizeMode = activeProject.settings.canvasSizeMode ?? "preset";
	const lastCustomCanvasSize =
		activeProject.settings.lastCustomCanvasSize ?? null;

	const presetItems = canvasPresets.map((preset) => {
		const ratio = dimensionToAspectRatio(preset);
		return {
			ratio,
			label: ASPECT_RATIO_LABELS[ratio] ?? ratio,
			canvasSize: preset,
		};
	});

	const selectedPresetRatio =
		canvasSizeMode === "preset"
			? (presetItems.find((preset) =>
					areCanvasSizesEqual({
						left: preset.canvasSize,
						right: currentCanvasSize,
					}),
				)?.ratio ?? null)
			: null;
	const isCustomSelected = canvasSizeMode === "custom";
	const selectValue = isCustomSelected
		? CUSTOM_VALUE
		: (selectedPresetRatio ?? CUSTOM_VALUE);

	const updateCustomCanvasSize = ({
		canvasSize,
	}: {
		canvasSize: TCanvasSize;
	}) => {
		editor.project.updateSettings({
			settings: {
				canvasSize,
				canvasSizeMode: "custom" as const,
				lastCustomCanvasSize: canvasSize,
			},
		});
	};

	const handleRatioChange = (value: string) => {
		if (value === CUSTOM_VALUE) {
			updateCustomCanvasSize({
				canvasSize: lastCustomCanvasSize ?? currentCanvasSize,
			});
			return;
		}

		const preset = presetItems.find((item) => item.ratio === value);
		if (!preset) return;

		editor.project.updateSettings({
			settings: {
				canvasSize: preset.canvasSize,
				canvasSizeMode: "preset" as const,
			},
		});
	};

	const widthDraft = useCanvasDimensionDraft({
		value: currentCanvasSize.width,
		onCommit: (width) =>
			updateCustomCanvasSize({
				canvasSize: { width, height: currentCanvasSize.height },
			}),
	});
	const heightDraft = useCanvasDimensionDraft({
		value: currentCanvasSize.height,
		onCommit: (height) =>
			updateCustomCanvasSize({
				canvasSize: { width: currentCanvasSize.width, height },
			}),
	});

	return (
		<Popover>
			<PopoverTrigger asChild>
				<Button variant="text" title="Configurações do projeto">
					<HugeiconsIcon icon={Settings02Icon} />
				</Button>
			</PopoverTrigger>
			<PopoverContent align="end" className="w-64 p-3">
				<p className="text-foreground mb-3 text-[13px] font-semibold">
					Configurações do projeto
				</p>

				<div className="flex flex-col gap-3">
					<div className="flex flex-col gap-1.5">
						<span className="text-muted-foreground text-xs">
							Taxa de quadros
						</span>
						<Select
							value={String(
								Math.round(frameRateToFloat(activeProject.settings.fps)),
							)}
							onValueChange={(value) => {
								const fps = floatToFrameRate(parseFloat(value));
								editor.project.updateSettings({ settings: { fps } });
							}}
						>
							<SelectTrigger className="h-9 w-full">
								<SelectValue placeholder="Selecione uma taxa de quadros" />
							</SelectTrigger>
							<SelectContent>
								{FPS_PRESETS.map((preset) => (
									<SelectItem key={preset.value} value={preset.value}>
										{preset.label}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
					</div>

					<div className="flex flex-col gap-1.5">
						<span className="text-muted-foreground text-xs">Proporção</span>
						<Select value={selectValue} onValueChange={handleRatioChange}>
							<SelectTrigger className="h-9 w-full">
								<SelectValue placeholder="Selecione uma proporção" />
							</SelectTrigger>
							<SelectContent>
								{presetItems.map((preset) => (
									<SelectItem key={preset.ratio} value={preset.ratio}>
										{preset.label}
									</SelectItem>
								))}
								<SelectItem value={CUSTOM_VALUE}>Personalizado</SelectItem>
							</SelectContent>
						</Select>

						{isCustomSelected && (
							<div className="flex items-center gap-2 pt-1">
								<NumberField
									value={widthDraft.displayValue}
									className="w-full"
									aria-label="Largura do canvas"
									onFocus={widthDraft.onFocus}
									onChange={widthDraft.onChange}
									onBlur={widthDraft.onBlur}
								/>
								<span className="text-muted-foreground text-xs">×</span>
								<NumberField
									value={heightDraft.displayValue}
									className="w-full"
									aria-label="Altura do canvas"
									onFocus={heightDraft.onFocus}
									onChange={heightDraft.onChange}
									onBlur={heightDraft.onBlur}
								/>
							</div>
						)}
					</div>

					<div className="border-border border-t pt-3">
						<p className="text-foreground mb-3 text-[13px] font-semibold">
							Visualização
						</p>
						<div className="flex flex-col gap-1.5">
							<span className="text-muted-foreground text-xs">
								Qualidade da pré-visualização
							</span>
							<Select
								value={previewResolutionScale}
								onValueChange={(value) =>
									setPreviewResolutionScale(
										value as (typeof PREVIEW_RESOLUTION_SCALE_OPTIONS)[number]["value"],
									)
								}
							>
								<SelectTrigger
									className="h-9 w-full"
									title="Reduza a resolução do Viewer para obter uma reprodução mais fluida. A mídia original e a exportação não são alteradas."
								>
									<SelectValue placeholder="Selecione a qualidade" />
								</SelectTrigger>
								<SelectContent>
									{PREVIEW_RESOLUTION_SCALE_OPTIONS.map((option) => (
										<SelectItem key={option.value} value={option.value}>
											{option.label}
										</SelectItem>
									))}
								</SelectContent>
							</Select>
							<p className="text-muted-foreground text-[11px] leading-snug">
								Reduz a qualidade apenas durante a edição para melhorar o
								desempenho. Não afeta a exportação.
							</p>
						</div>
					</div>
				</div>
			</PopoverContent>
		</Popover>
	);
}
