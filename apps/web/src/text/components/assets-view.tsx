"use client";

import { useEffect, useState } from "react";
import { toast } from "sonner";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { PanelView } from "@/components/editor/panels/assets/views/base-panel";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
	Dialog,
	DialogBody,
	DialogContent,
	DialogFooter,
	DialogHeader,
	DialogTitle,
} from "@/components/ui/dialog";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	MoreHorizontalIcon,
	Copy01Icon,
	PencilEdit02Icon,
	Delete02Icon,
} from "@hugeicons/core-free-icons";
import { useEditor } from "@/editor/use-editor";
import { DEFAULTS } from "@/timeline/defaults";
import { buildTextElement } from "@/timeline/element-utils";
import { UpdateElementsCommand } from "@/commands";
import type { MediaTime } from "@/wasm";
import { useTextPresetsStore, type TextPreset } from "@/text/text-presets-store";
import { applyTextStyleValues } from "@/text/text-preset-apply";

export function TextView() {
	const editor = useEditor();
	const presets = useTextPresetsStore((s) => s.presets);
	const load = useTextPresetsStore((s) => s.load);
	const rename = useTextPresetsStore((s) => s.rename);
	const duplicate = useTextPresetsStore((s) => s.duplicate);
	const remove = useTextPresetsStore((s) => s.remove);
	const [renamingPreset, setRenamingPreset] = useState<TextPreset | null>(null);

	useEffect(() => {
		void load();
	}, [load]);

	const handleAddToTimeline = ({ currentTime }: { currentTime: MediaTime }) => {
		const activeScene = editor.scenes.getActiveScene();
		if (!activeScene) return;

		const element = buildTextElement({
			raw: DEFAULTS.text.element,
			startTime: currentTime,
		});

		editor.timeline.insertElement({
			element,
			placement: { mode: "auto" },
		});
	};

	const handleApplyPreset = (preset: TextPreset) => {
		const selected = editor.selection.getSelectedElements()[0];
		if (!selected) {
			toast.error("Selecione um texto na linha do tempo para aplicar o estilo");
			return;
		}

		const found = editor.timeline.getElementsWithTracks({
			elements: [selected],
		})[0];
		if (!found || found.element.type !== "text") {
			toast.error("Selecione um elemento de texto para aplicar o estilo");
			return;
		}

		const patchedParams = applyTextStyleValues({
			element: found.element,
			values: preset.values,
		});

		editor.command.execute({
			command: new UpdateElementsCommand({
				updates: [
					{
						trackId: found.track.id,
						elementId: found.element.id,
						patch: { params: patchedParams },
					},
				],
			}),
		});
		toast.success(`Estilo "${preset.name}" aplicado`);
	};

	return (
		<PanelView title="Texto">
			<div className="flex flex-col gap-6">
				<section className="flex flex-col gap-2">
					<DraggableItem
						name="Default text"
						preview={
							<div className="bg-accent flex size-full items-center justify-center rounded">
								<span className="text-xs select-none">Default text</span>
							</div>
						}
						dragData={{
							id: "temp-text-id",
							type: DEFAULTS.text.element.type,
							name: DEFAULTS.text.element.name,
							content: "Default text",
						}}
						aspectRatio={1}
						onAddToTimeline={handleAddToTimeline}
						shouldShowLabel={false}
					/>
				</section>

				<section className="flex flex-col gap-2">
					<h3 className="text-muted-foreground text-xs font-medium uppercase tracking-wide">
						Meus estilos
					</h3>
					{presets.length === 0 ? (
						<p className="text-muted-foreground text-xs">
							Configure um texto e clique em &quot;Salvar como
							predefinição&quot; para ele aparecer aqui.
						</p>
					) : (
						<div className="grid grid-cols-2 gap-2">
							{presets.map((preset) => (
								<TextPresetCard
									key={preset.id}
									preset={preset}
									onApply={() => handleApplyPreset(preset)}
									onDuplicate={() => void duplicate(preset.id)}
									onRename={() => setRenamingPreset(preset)}
									onDelete={() => void remove(preset.id)}
								/>
							))}
						</div>
					)}
				</section>
			</div>

			<RenamePresetDialog
				preset={renamingPreset}
				onOpenChange={(open) => !open && setRenamingPreset(null)}
				onConfirm={(name) => {
					if (renamingPreset) void rename({ id: renamingPreset.id, name });
					setRenamingPreset(null);
				}}
			/>
		</PanelView>
	);
}

function TextPresetCard({
	preset,
	onApply,
	onDuplicate,
	onRename,
	onDelete,
}: {
	preset: TextPreset;
	onApply: () => void;
	onDuplicate: () => void;
	onRename: () => void;
	onDelete: () => void;
}) {
	const color =
		typeof preset.values.color === "string" ? preset.values.color : "#FFFFFF";
	const fontWeight =
		typeof preset.values.fontWeight === "string" ? preset.values.fontWeight : "600";
	const fontFamily =
		typeof preset.values.fontFamily === "string"
			? preset.values.fontFamily
			: undefined;

	return (
		<div className="group border-border bg-elevated relative flex flex-col overflow-hidden rounded-md border">
			<button
				type="button"
				onClick={onApply}
				className="hover:border-primary/35 flex aspect-square w-full flex-col items-center justify-center border border-transparent transition-colors"
				title={`Aplicar "${preset.name}"`}
			>
				<span
					style={{ color, fontWeight, fontFamily }}
					className="text-2xl select-none"
				>
					Aa
				</span>
			</button>
			<div className="border-border flex items-center justify-between border-t px-2 py-1.5">
				<span className="truncate text-[11px]">{preset.name}</span>
				<DropdownMenu>
					<DropdownMenuTrigger asChild>
						<Button
							variant="text"
							size="icon"
							className="size-5 shrink-0 opacity-0 group-hover:opacity-100"
							onClick={(event) => event.stopPropagation()}
						>
							<HugeiconsIcon icon={MoreHorizontalIcon} className="size-3.5" />
						</Button>
					</DropdownMenuTrigger>
					<DropdownMenuContent align="end">
						<DropdownMenuItem onClick={onRename}>
							<HugeiconsIcon icon={PencilEdit02Icon} />
							Renomear
						</DropdownMenuItem>
						<DropdownMenuItem onClick={onDuplicate}>
							<HugeiconsIcon icon={Copy01Icon} />
							Duplicar
						</DropdownMenuItem>
						<DropdownMenuItem variant="destructive" onClick={onDelete}>
							<HugeiconsIcon icon={Delete02Icon} />
							Excluir
						</DropdownMenuItem>
					</DropdownMenuContent>
				</DropdownMenu>
			</div>
		</div>
	);
}

function RenamePresetDialog({
	preset,
	onOpenChange,
	onConfirm,
}: {
	preset: TextPreset | null;
	onOpenChange: (open: boolean) => void;
	onConfirm: (name: string) => void;
}) {
	return (
		<Dialog open={!!preset} onOpenChange={onOpenChange}>
			<DialogContent className="max-w-sm">
				<DialogHeader>
					<DialogTitle>Renomear predefinição</DialogTitle>
				</DialogHeader>
				<RenameInput
					key={preset?.id}
					initialName={preset?.name ?? ""}
					onCancel={() => onOpenChange(false)}
					onConfirm={onConfirm}
				/>
			</DialogContent>
		</Dialog>
	);
}

function RenameInput({
	initialName,
	onCancel,
	onConfirm,
}: {
	initialName: string;
	onCancel: () => void;
	onConfirm: (name: string) => void;
}) {
	const [name, setName] = useState(initialName);

	return (
		<>
			<DialogBody>
				<Input
					value={name}
					onChange={(event) => setName(event.target.value)}
					onKeyDown={(event) => {
						if (event.key === "Enter" && name.trim()) {
							event.preventDefault();
							onConfirm(name.trim());
						}
					}}
				/>
			</DialogBody>
			<DialogFooter>
				<Button variant="outline" onClick={onCancel}>
					Cancelar
				</Button>
				<Button
					onClick={() => name.trim() && onConfirm(name.trim())}
					disabled={!name.trim()}
				>
					Salvar
				</Button>
			</DialogFooter>
		</>
	);
}
