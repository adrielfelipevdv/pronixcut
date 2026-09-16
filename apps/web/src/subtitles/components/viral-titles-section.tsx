"use client";

import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Section,
	SectionContent,
	SectionHeader,
	SectionTitle,
} from "@/components/section";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	FloppyDiskIcon,
	Delete02Icon,
	CheckmarkCircle02Icon,
	MoreHorizontalIcon,
} from "@hugeicons/core-free-icons";
import { useEditor } from "@/editor/use-editor";
import { cn } from "@/utils/ui";
import type { TextElement } from "@/timeline/types";
import { BUILTIN_VIRAL_TITLE_PRESETS } from "@/subtitles/viral-titles/presets";
import { useCustomViralTitlePresetsStore } from "@/subtitles/viral-titles/custom-presets-store";
import { applyViralTitlePreset } from "@/subtitles/viral-titles/apply";
import type { ViralTitlePreset } from "@/subtitles/viral-titles/types";
import { readWordHighlightStyleFromParams } from "@/text/word-highlight";

interface CaptionBlock {
	trackId: string;
	element: TextElement;
}

function useCaptionBlocks(): CaptionBlock[] {
	const tracks = useEditor((e) => e.scenes.getActiveScene().tracks);
	return useMemo(() => {
		const result: CaptionBlock[] = [];
		for (const track of tracks.overlay) {
			if (track.type !== "text") continue;
			for (const element of track.elements) {
				if (element.type === "text") {
					result.push({ trackId: track.id, element });
				}
			}
		}
		return result.sort((a, b) => a.element.startTime - b.element.startTime);
	}, [tracks]);
}

export function ViralTitlesSection() {
	const editor = useEditor();
	const blocks = useCaptionBlocks();
	const selectedElements = useEditor((e) => e.selection.getSelectedElements());
	const customPresets = useCustomViralTitlePresetsStore((s) => s.presets);
	const loadCustomPresets = useCustomViralTitlePresetsStore((s) => s.load);
	const [saveDialogPreset, setSaveDialogPreset] = useState<TextElement | null>(
		null,
	);

	useEffect(() => {
		loadCustomPresets();
	}, [loadCustomPresets]);

	if (blocks.length === 0) {
		return null;
	}

	const selectedBlocks = blocks.filter((block) =>
		selectedElements.some(
			(sel) => sel.trackId === block.trackId && sel.elementId === block.element.id,
		),
	);

	const handleApply = ({
		preset,
		targets,
	}: {
		preset: ViralTitlePreset;
		targets: CaptionBlock[];
	}) => {
		if (targets.length === 0) {
			toast.error("Nenhuma legenda para aplicar");
			return;
		}
		applyViralTitlePreset({ editor, blocks: targets, preset });
		toast.success(
			`"${preset.name}" aplicado a ${targets.length} legenda${targets.length > 1 ? "s" : ""}`,
		);
	};

	const allPresets: ViralTitlePreset[] = [...BUILTIN_VIRAL_TITLE_PRESETS, ...customPresets];

	return (
		<Section sectionKey="viral-titles" collapsible defaultOpen>
			<SectionHeader>
				<SectionTitle>Títulos virais</SectionTitle>
			</SectionHeader>
			<SectionContent className="flex flex-col gap-2">
				<div
					className="grid gap-2"
					style={{ gridTemplateColumns: "repeat(auto-fill, minmax(84px, 1fr))" }}
				>
					{allPresets.map((preset) => (
						<ViralTitleCard
							key={preset.id}
							preset={preset}
							isCustom={customPresets.some((p) => p.id === preset.id)}
							onApplyAll={() => handleApply({ preset, targets: blocks })}
							onApplySelected={() =>
								handleApply({ preset, targets: selectedBlocks })
							}
							canApplySelected={selectedBlocks.length > 0}
						/>
					))}
				</div>

				{saveDialogPreset && (
					<SaveViralTitleDialog
						element={saveDialogPreset}
						onClose={() => setSaveDialogPreset(null)}
					/>
				)}

				{selectedBlocks.length === 1 && selectedBlocks[0] && (
					<Button
						variant="outline"
						size="sm"
						className="gap-1.5"
						onClick={() => setSaveDialogPreset(selectedBlocks[0]!.element)}
					>
						<HugeiconsIcon icon={FloppyDiskIcon} className="size-3.5" />
						Salvar como predefinição
					</Button>
				)}
			</SectionContent>
		</Section>
	);
}

function ViralTitleCard({
	preset,
	isCustom,
	onApplyAll,
	onApplySelected,
	canApplySelected,
}: {
	preset: ViralTitlePreset;
	isCustom: boolean;
	onApplyAll: () => void;
	onApplySelected: () => void;
	canApplySelected: boolean;
}) {
	const remove = useCustomViralTitlePresetsStore((s) => s.remove);
	const style = readWordHighlightStyleFromParams({ params: preset.values });
	const baseColor =
		typeof preset.values.color === "string" ? preset.values.color : "#ffffff";

	return (
		<div className="group relative flex flex-col gap-1">
			<div
				className="bg-elevated border-border relative flex aspect-square w-full items-center justify-center overflow-hidden rounded-sm border p-1 text-center"
				style={{ background: "#111214" }}
			>
				<span
					className="text-[11px] font-bold leading-tight"
					style={{
						color: baseColor,
						WebkitTextStroke:
							style.enabled && preset.values["stroke.enabled"]
								? `1px ${String(preset.values["stroke.color"] ?? "#000")}`
								: undefined,
					}}
				>
					Título{" "}
					<span style={{ color: style.enabled ? style.activeColor : baseColor }}>
						viral
					</span>
				</span>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<button
							type="button"
							className="absolute right-1 top-1 flex size-5 items-center justify-center rounded bg-black/40 text-white opacity-0 transition-opacity group-hover:opacity-100"
							title="Aplicar"
						>
							<HugeiconsIcon icon={MoreHorizontalIcon} className="size-3.5" />
						</button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onApplyAll}>
							<HugeiconsIcon icon={CheckmarkCircle02Icon} className="size-3.5" />
							Aplicar a todas
						</DropdownMenuItem>
						<DropdownMenuItem
							disabled={!canApplySelected}
							onClick={onApplySelected}
						>
							Aplicar às selecionadas
						</DropdownMenuItem>
						{isCustom && (
							<DropdownMenuItem
								className="text-destructive"
								onClick={() => remove(preset.id)}
							>
								<HugeiconsIcon icon={Delete02Icon} className="size-3.5" />
								Excluir
							</DropdownMenuItem>
						)}
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
			<span
				className={cn(
					"text-muted-foreground w-full truncate text-center text-[0.7rem]",
				)}
			>
				{preset.name}
			</span>
		</div>
	);
}

function SaveViralTitleDialog({
	element,
	onClose,
}: {
	element: TextElement;
	onClose: () => void;
}) {
	const [name, setName] = useState("");
	const save = useCustomViralTitlePresetsStore((s) => s.save);

	const handleSave = async () => {
		const trimmed = name.trim();
		if (!trimmed) return;
		const values = { ...element.params };
		await save({ name: trimmed, values });
		toast.success(`Título viral "${trimmed}" salvo em Meus títulos`);
		onClose();
	};

	return (
		<Dialog open onOpenChange={(open) => !open && onClose()}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Salvar título viral</DialogTitle>
				</DialogHeader>
				<DialogBody>
					<span className="text-muted-foreground mb-1.5 block text-xs">
						Nome
					</span>
					<Input
						value={name}
						onChange={(event) => setName(event.target.value)}
						placeholder="Ex: Viral PRONIX"
						onKeyDown={(event) => {
							if (event.key === "Enter") {
								event.preventDefault();
								void handleSave();
							}
						}}
					/>
				</DialogBody>
				<DialogFooter>
					<Button variant="outline" onClick={onClose}>
						Cancelar
					</Button>
					<Button onClick={() => void handleSave()} disabled={!name.trim()}>
						Salvar
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
