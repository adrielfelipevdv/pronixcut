"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { Button } from "@/components/ui/button";
import { effectsRegistry, EFFECT_TARGET_ELEMENT_TYPES, isCanvas2DEffect } from "@/effects";
import { effectPreviewService } from "@/services/renderer/effect-preview";
import { useEditor } from "@/editor/use-editor";
import type { EditorCore } from "@/core";
import { buildEffectElement } from "@/timeline/element-utils";
import { findTrackInSceneTracks } from "@/timeline/track-element-update";
import { VISUAL_ELEMENT_TYPES } from "@/timeline";
import type { EffectDefinition } from "@/effects/types";
import type { ParamValues } from "@/params";
import { buildDefaultParamValues } from "@/params/registry";
import { CHROMA_KEY_EFFECT_TYPE } from "@/effects/definitions/chroma-key";
import { presetToEffectParams } from "@/effects/color-grade/presets";
import { COLOR_GRADE_EFFECT_TYPE } from "@/effects/color-grade/definition";
import { useCustomEffectPresetsStore, type CustomColorGradePreset } from "@/effects/color-grade/custom-presets-store";
import { ColorGradeEditorDialog } from "@/effects/color-grade/components/color-grade-editor-dialog";
import { useElementSelection } from "@/timeline/hooks/element/use-element-selection";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	Delete02Icon,
	PlusSignIcon,
	CheckmarkCircle02Icon,
	MagicWand05Icon,
	ArrowExpandIcon,
} from "@hugeicons/core-free-icons";
import { BackgroundContent } from "@/components/editor/panels/assets/views/settings/background";
import { TransformFields } from "@/components/editor/panels/properties/components/transform-fields";
import type { VisualElement } from "@/timeline";
import { cn } from "@/utils/ui";

// Library navigation (hover, click-to-select, scrolling past cards) must
// never touch the project — only an explicit "Aplicar" (or drag-to-timeline,
// or the existing hover-reveal "+") does. `selectedLibraryItemId` is pure UI
// state for which card is highlighted in this panel; it is NEVER read by the
// renderer and never assigned into any clip's `effects` array by itself —
// see `applyClipEffect`/`handleAddToTimeline` below, which are the only
// functions that actually mutate the project.
export function EffectsView() {
	const [selectedLibraryItemId, setSelectedLibraryItemId] = useState<string | null>(null);
	const allDefinitions = effectsRegistry.getAll();
	// Chroma key only ever makes sense attached to one specific clip (it reads
	// that clip's own pixels), unlike blur/color-grade which can also run as a
	// scene-wide effect-track layer — so it gets its own "apply to selected
	// clip" card below instead of sitting in the generic scene-effect grid.
	const gpuEffects = allDefinitions.filter(
		(definition) =>
			!isCanvas2DEffect({ definition }) && definition.type !== CHROMA_KEY_EFFECT_TYPE,
	);
	const chromaKeyDefinition = effectsRegistry.get(CHROMA_KEY_EFFECT_TYPE);
	const customPresets = useCustomEffectPresetsStore((s) => s.presets);
	const loadCustomPresets = useCustomEffectPresetsStore((s) => s.load);
	const removeCustomPreset = useCustomEffectPresetsStore((s) => s.remove);
	const [dialogOpen, setDialogOpen] = useState(false);

	useEffect(() => {
		loadCustomPresets();
	}, [loadCustomPresets]);

	// Every card in this library grid renders against the same standard
	// reference photo (public/effects/preview.jpg), by design — this used to
	// also let a click swap in a real captured frame from the project, which
	// silently broke the "always the same photo" requirement: capturing
	// before the renderer had produced a real frame (e.g. on mount, or at an
	// empty moment in the timeline) captured a blank/black canvas that then
	// permanently overrode the stock photo for every card, session-wide,
	// making the whole grid look photo-less. Removed.

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
					<h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
						Resolve FX
					</h3>
					<ResolveFxTransformSection />
				</section>

				<section className="flex flex-col gap-2">
					<h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
						Efeitos
					</h3>
					<EffectsGrid
						effects={gpuEffects}
						selectedId={selectedLibraryItemId}
						onSelect={setSelectedLibraryItemId}
					/>
				</section>

				<section className="flex flex-col gap-2">
					<h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
						Chroma Key
					</h3>
					<div
						className="grid gap-2"
						style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}
					>
						<ChromaKeyItem
							definition={chromaKeyDefinition}
							isSelected={selectedLibraryItemId === chromaKeyDefinition.type}
							onSelect={() => setSelectedLibraryItemId(chromaKeyDefinition.type)}
						/>
					</div>
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

function EffectsGrid({
	effects,
	selectedId,
	onSelect,
}: {
	effects: EffectDefinition[];
	selectedId: string | null;
	onSelect: (id: string) => void;
}) {
	return (
		<div
			className="grid gap-2"
			style={{ gridTemplateColumns: "repeat(auto-fill, minmax(96px, 1fr))" }}
		>
			{effects.map((effect) => (
				<EffectItem
					key={effect.type}
					effect={effect}
					isSelected={selectedId === effect.type}
					onSelect={() => onSelect(effect.type)}
				/>
			))}
		</div>
	);
}

// The card's own thumbnail intentionally shows the stock demo photo with the
// effect applied (that's the whole point of a preview). The floating
// drag-ghost is different: it can hover directly over the main viewer while
// the user drags toward the timeline, and a demo photo appearing "in" the
// video there reads as a bug, not a preview — so effects get a plain
// icon+name ghost instead, never the demo photo.
function EffectDragGhost({ name }: { name: string }) {
	return (
		<div className="bg-popover text-foreground flex size-full flex-col items-center justify-center gap-1 p-2">
			<HugeiconsIcon icon={MagicWand05Icon} className="text-primary size-5" />
			<span className="max-w-full truncate text-center text-[11px] font-medium">
				{name}
			</span>
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

function EffectItem({
	effect,
	isSelected,
	onSelect,
}: {
	effect: EffectDefinition;
	isSelected: boolean;
	onSelect: () => void;
}) {
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

	// Selecting a card is pure navigation — it only sets which card is
	// highlighted in THIS panel (`isSelected`/`onSelect`, owned by
	// EffectsView above). It never touches the timeline/project; only
	// `handleAddToTimeline` (the hover "+", drag-to-timeline, or the
	// "Aplicar" button below) does that.
	const preview = <EffectPreviewCanvas effectType={effect.type} />;

	return (
		<div
			className={cn(
				"flex flex-col gap-1 rounded-md p-1 ring-1 ring-transparent transition-colors",
				isSelected && "ring-primary bg-primary/5",
			)}
			onClick={onSelect}
		>
			<DraggableItem
				name={effect.name}
				preview={preview}
				dragGhost={<EffectDragGhost name={effect.name} />}
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
			{isSelected && (
				<Button
					size="sm"
					variant="secondary"
					className="h-6 gap-1 text-xs"
					onClick={(event) => {
						event.stopPropagation();
						handleAddToTimeline();
					}}
				>
					<HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
					Aplicar
				</Button>
			)}
		</div>
	);
}

function applyClipEffect({
	editor,
	effectType,
	initialParams,
	label,
}: {
	editor: EditorCore;
	effectType: string;
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
		effectType,
		initialParams,
	});
	toast.success(`"${label}" aplicado ao clipe selecionado`);
}

// Transform (position/scale/rotation/anchor/opacity/flip) isn't a toggleable
// effect — every visual clip already has it, fully keyframable, with its own
// on-canvas handles (see TransformFields/use-transform-handles). Rather than
// a card whose "Aplicar" just jumped the user to a different panel (easy to
// miss, and "apply" implied an on/off toggle that doesn't exist), this shows
// the real, live-working controls right here once a compatible clip is
// selected — no separate panel to find, nothing to "activate" first.
function ResolveFxTransformSection() {
	const editor = useEditor();
	const { selectedElements } = useElementSelection();
	const [isExpanded, setIsExpanded] = useState(false);

	const resolved = (() => {
		if (selectedElements.length !== 1) return null;
		const selected = selectedElements[0];
		const track = findTrackInSceneTracks({
			tracks: editor.scenes.getActiveScene().tracks,
			trackId: selected.trackId,
		});
		const element = track?.elements.find((el) => el.id === selected.elementId);
		if (
			!element ||
			!(VISUAL_ELEMENT_TYPES as readonly string[]).includes(element.type)
		) {
			return null;
		}
		return { element: element as VisualElement, trackId: selected.trackId };
	})();

	if (!resolved) {
		return (
			<p className="text-muted-foreground text-xs">
				Selecione um vídeo ou imagem na linha do tempo para usar Transformação.
			</p>
		);
	}

	return (
		<div className="border-border flex flex-col gap-2 rounded-md border p-2">
			<button
				type="button"
				className="flex items-center justify-between gap-2 text-left"
				onClick={() => setIsExpanded((prev) => !prev)}
			>
				<span className="flex items-center gap-2 text-sm font-medium">
					<HugeiconsIcon icon={ArrowExpandIcon} className="size-4" />
					Transformação
				</span>
				<span className="text-primary text-xs">
					{isExpanded ? "Recolher" : "Editar transformação"}
				</span>
			</button>
			{isExpanded ? (
				<TransformFields element={resolved.element} trackId={resolved.trackId} />
			) : (
				<p className="text-muted-foreground text-xs">
					Mover, redimensionar, rotacionar e animar o clipe.
				</p>
			)}
		</div>
	);
}

function ChromaKeyItem({
	definition,
	isSelected,
	onSelect,
}: {
	definition: EffectDefinition;
	isSelected: boolean;
	onSelect: () => void;
}) {
	const editor = useEditor();
	const { selectedElements } = useElementSelection();
	const hasCompatibleClip = selectedElements.length > 0;
	const defaultParams = buildDefaultParamValues(definition.params);

	const handleApply = useCallback(() => {
		applyClipEffect({
			editor,
			effectType: definition.type,
			initialParams: defaultParams,
			label: definition.name,
		});
	}, [editor, definition.type, definition.name, defaultParams]);

	return (
		<div
			className={cn(
				"flex flex-col gap-1 rounded-md p-1 ring-1 ring-transparent transition-colors",
				isSelected && "ring-primary bg-primary/5",
			)}
			onClick={onSelect}
		>
			<DraggableItem
				name={definition.name}
				preview={<EffectPreviewCanvas effectType={definition.type} params={defaultParams} />}
				dragGhost={<EffectDragGhost name={definition.name} />}
				dragData={{
					id: definition.type,
					name: definition.name,
					type: "effect",
					effectType: definition.type,
					targetElementTypes: EFFECT_TARGET_ELEMENT_TYPES,
				}}
				onAddToTimeline={handleApply}
				aspectRatio={1}
				isRounded
				variant="card"
				containerClassName="w-full"
			/>
			{isSelected && (
				<Button
					size="sm"
					variant="secondary"
					className="h-6 gap-1 text-xs"
					disabled={!hasCompatibleClip}
					title={
						hasCompatibleClip
							? undefined
							: "Selecione um vídeo ou imagem na linha do tempo."
					}
					onClick={(event) => {
						event.stopPropagation();
						handleApply();
					}}
				>
					<HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
					Aplicar
				</Button>
			)}
		</div>
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
				dragGhost={<EffectDragGhost name={preset.name} />}
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
