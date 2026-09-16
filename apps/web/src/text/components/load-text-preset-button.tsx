"use client";

import { useEffect } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
	DropdownMenu,
	DropdownMenuContent,
	DropdownMenuItem,
	DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { HugeiconsIcon } from "@hugeicons/react";
import { FolderOpenIcon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/editor/use-editor";
import { UpdateElementsCommand } from "@/commands";
import { useTextPresetsStore, type TextPreset } from "@/text/text-presets-store";
import { applyTextStyleValues } from "@/text/text-preset-apply";
import type { TextElement } from "@/timeline";

export function LoadTextPresetButton({
	element,
	trackId,
}: {
	element: TextElement;
	trackId: string;
}) {
	const editor = useEditor();
	const presets = useTextPresetsStore((s) => s.presets);
	const load = useTextPresetsStore((s) => s.load);

	useEffect(() => {
		void load();
	}, [load]);

	const handleApply = (preset: TextPreset) => {
		const patchedParams = applyTextStyleValues({ element, values: preset.values });
		editor.command.execute({
			command: new UpdateElementsCommand({
				updates: [
					{
						trackId,
						elementId: element.id,
						patch: { params: patchedParams },
					},
				],
			}),
		});
		toast.success(`Estilo "${preset.name}" aplicado`);
	};

	return (
		<DropdownMenu>
			<DropdownMenuTrigger asChild>
				<Button variant="outline" size="sm" className="flex-1 gap-1.5">
					<HugeiconsIcon icon={FolderOpenIcon} className="size-3.5" />
					Carregar
				</Button>
			</DropdownMenuTrigger>
			<DropdownMenuContent align="start" className="max-h-72 w-56 overflow-y-auto">
				{presets.length === 0 ? (
					<div className="text-muted-foreground px-2 py-1.5 text-xs">
						Nenhuma predefinição salva ainda
					</div>
				) : (
					presets.map((preset) => (
						<DropdownMenuItem
							key={preset.id}
							onClick={() => handleApply(preset)}
						>
							<span className="truncate">{preset.name}</span>
						</DropdownMenuItem>
					))
				)}
			</DropdownMenuContent>
		</DropdownMenu>
	);
}
