"use client";

import { useEffect, useRef, useCallback, useState } from "react";
import { toast } from "sonner";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { Button } from "@/components/ui/button";
import { effectsRegistry, EFFECT_TARGET_ELEMENT_TYPES, isCanvas2DEffect } from "@/effects";
import { effectPreviewService } from "@/services/renderer/effect-preview";
import { useEditor } from "@/editor/use-editor";
import type { EditorCore } from "@/core";
import { buildEffectElement } from "@/timeline/element-utils";
import type { EffectDefinition } from "@/effects/types";
import type { ParamValues } from "@/params";
import { BUILTIN_COLOR_GRADE_PRESETS, presetToEffectParams, type ColorGradePreset } from "@/effects/color-grade/presets";
import { COLOR_GRADE_EFFECT_TYPE } from "@/effects/color-grade/definition";
import { useCustomEffectPresetsStore, type CustomColorGradePreset } from "@/effects/color-grade/custom-presets-store";
import { ColorGradeEditorDialog } from "@/effects/color-grade/components/color-grade-editor-dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import { Delete02Icon, PlusSignIcon, Refresh01Icon } from "@hugeicons/core-free-icons";
import { BackgroundContent } from "@/components/editor/panels/assets/views/settings/background";

export function EffectsView() {
	const editor = useEditor();
	const allDefinitions = effectsRegistry.getAll();
	const gpuEffects = allDefinitions.filter((definition) => !isCanvas2DEffect({ definition }));
	const customPresets = useCustomEffectPresetsStore((s) => s.presets);
	const loadCustomPresets = useCustomEffectPresetsStore((s) => s.load);
	const removeCustomPreset = useCustomEffectPresetsStore((s) => s.remove);
	const [dialogOpen, setDialogOpen] = useState(false);
	const selectedElementId = useEditor(
		(e) => e.selection.getSelectedElements()[0]?.elementId ?? null,
	);

	useEffect(() => {
		loadCustomPresets();
	}, [loadCustomPresets]);

	const captureReferenceFrame = useCallback(async () => {
		// One-shot render of the current frame — same mechanism as the
		// snapshot/copy-frame feature, not run continuously. Real thumbnails
		// of the project being edited instead of the generic stock photo.
		const canvas = await editor.renderer.captureCurrentFrameCanvas();
		effectPreviewService.setReferenceFrame({ source: canvas });
	}, [editor]);

	useEffect(() => {
		captureReferenceFrame();
		// Re-captures when the selected clip changes, or once on mount —
		// never on every playback tick.
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, [selectedElementId]);

	return (
		<PanelView title="Efeitos">
			<div className="flex flex-col gap-6">
				<section className="flex flex-col gap-2">
					<h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
						Fundo
					</h3>
					<div className="border-border -mx-2 border-b" />
					<BackgroundContent />
				</section>

				<section className="flex flex-col gap-2">
					<div className="flex items-center justify-between">
						<h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
							Efeitos
						</h3>
						<Button
							variant="text"
							size="icon"
							className="size-5"
							title="Atualizar preview com o frame atual"
							onClick={captureReferenceFrame}
						>
							<HugeiconsIcon icon={Refresh01Icon} className="size-3.5" />
						</Button>
					</div>
					<EffectsGrid effects={gpuEffects} />
				</section>

				<section className="flex flex-col gap-2">
					<h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
						Pré-definidos
					</h3>
					<PresetsGrid presets={BUILTIN_COLOR_GRADE_PRESETS} />
				</section>

				<section className="flex flex-col gap-2">
					<div className="flex items-center justify-between">
						<h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
							Meus efeitos
						</h3>
						<Button variant="outline" size="sm" className="h-6 gap-1 px-2 text-xs" onClick={() => setDialogOpen(true)}>
							<HugeiconsIcon icon={PlusSignIcon} className="size-3.5" />
							Criar efeito
						</Button>
					</div>
					{customPresets.length === 0 ? (
						<p className="text-muted-foreground text-xs">
							Nenhum efeito personalizado ainda. Clique em "Criar efeito" para
							montar o seu.
						</p>
					) : (
						<CustomPresetsGrid presets={customPresets} onRemove={removeCustomPreset} />
					)}
				</section>
			</div>

			<ColorGradeEditorDialog open={dialogOpen} onOpenChange={setDialogOpen} />
		</PanelView>
	);
}

function EffectsGrid({ effects }: { effects: EffectDefinition[] }) {
	return (
		<div
			className="grid gap-2"
			style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}
		>
			{effects.map((effect) => (
				<EffectItem key={effect.type} effect={effect} />
			))}
		</div>
	);
}

function EffectPreviewCanvas({
	effectType,
	params,
}: {
	effectType: string;
	params?: ParamValues;
}) {
	const canvasRef = useRef<HTMLCanvasElement>(null);

	useEffect(() => {
		const render = () => {
			if (canvasRef.current) {
				effectPreviewService.renderPreview({
					effectType,
					params: params ?? {},
					targetCanvas: canvasRef.current,
				});
			}
		};

		render();
		return effectPreviewService.onPreviewImageReady({ callback: render });
	}, [effectType, params]);

	return <canvas ref={canvasRef} className="size-full" />;
}

function EffectItem({ effect }: { effect: EffectDefinition }) {
	const editor = useEditor();

	const handleAddToTimeline = useCallback(() => {
		const currentTime = editor.playback.getCurrentTime();
		const element = buildEffectElement({
			effectType: effect.type,
			startTime: currentTime,
		});

		editor.timeline.insertElement({
			placement: { mode: "auto", trackType: "effect" },
			element,
		});
	}, [editor, effect.type]);

	const preview = <EffectPreviewCanvas effectType={effect.type} />;

	return (
		<DraggableItem
			name={effect.name}
			preview={preview}
			dragData={{
				id: effect.type,
				name: effect.name,
				type: "effect",
				effectType: effect.type,
				targetElementTypes: EFFECT_TARGET_ELEMENT_TYPES,
			}}
			onAddToTimeline={handleAddToTimeline}
			aspectRatio={1}
			isRounded
			variant="card"
			containerClassName="w-full"
		/>
	);
}

function applyColorGradeToSelection({
	editor,
	initialParams,
	label,
}: {
	editor: EditorCore;
	initialParams: ParamValues;
	label: string;
}) {
	const selected = editor.selection.getSelectedElements()[0];
	if (!selected) {
		toast.error("Selecione um clipe na timeline para aplicar esse efeito");
		return;
	}
	editor.timeline.addClipEffect({
		trackId: selected.trackId,
		elementId: selected.elementId,
		effectType: COLOR_GRADE_EFFECT_TYPE,
		initialParams,
	});
	toast.success(`"${label}" aplicado ao clipe selecionado`);
}

function PresetsGrid({ presets }: { presets: ColorGradePreset[] }) {
	return (
		<div
			className="grid gap-2"
			style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}
		>
			{presets.map((preset) => (
				<PresetItem key={preset.id} preset={preset} />
			))}
		</div>
	);
}

function PresetItem({ preset }: { preset: ColorGradePreset }) {
	const editor = useEditor();
	const params = presetToEffectParams(preset.values);

	return (
		<DraggableItem
			name={preset.name}
			preview={<EffectPreviewCanvas effectType={COLOR_GRADE_EFFECT_TYPE} params={params} />}
			dragData={{
				id: `preset:${preset.id}`,
				name: preset.name,
				type: "effect",
				effectType: COLOR_GRADE_EFFECT_TYPE,
				targetElementTypes: EFFECT_TARGET_ELEMENT_TYPES,
				initialParams: params,
			}}
			onAddToTimeline={() =>
				applyColorGradeToSelection({ editor, initialParams: params, label: preset.name })
			}
			aspectRatio={1}
			isRounded
			variant="card"
			containerClassName="w-full"
		/>
	);
}

function CustomPresetsGrid({
	presets,
	onRemove,
}: {
	presets: CustomColorGradePreset[];
	onRemove: (id: string) => void;
}) {
	return (
		<div
			className="grid gap-2"
			style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}
		>
			{presets.map((preset) => (
				<CustomPresetItem key={preset.id} preset={preset} onRemove={onRemove} />
			))}
		</div>
	);
}

function CustomPresetItem({
	preset,
	onRemove,
}: {
	preset: CustomColorGradePreset;
	onRemove: (id: string) => void;
}) {
	const editor = useEditor();
	const params = presetToEffectParams(preset.values);

	return (
		<div className="group relative">
			<DraggableItem
				name={preset.name}
				preview={<EffectPreviewCanvas effectType={COLOR_GRADE_EFFECT_TYPE} params={params} />}
				dragData={{
					id: `custom:${preset.id}`,
					name: preset.name,
					type: "effect",
					effectType: COLOR_GRADE_EFFECT_TYPE,
					targetElementTypes: EFFECT_TARGET_ELEMENT_TYPES,
					initialParams: params,
				}}
				onAddToTimeline={() =>
					applyColorGradeToSelection({ editor, initialParams: params, label: preset.name })
				}
				aspectRatio={1}
				isRounded
				variant="card"
				containerClassName="w-full"
			/>
			<Button
				variant="text"
				size="icon"
				className="bg-background/80 absolute top-1 right-1 size-5 opacity-0 group-hover:opacity-100"
				onClick={(event) => {
					event.stopPropagation();
					onRemove(preset.id);
				}}
				title="Remover"
			>
				<HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
			</Button>
		</div>
	);
}
