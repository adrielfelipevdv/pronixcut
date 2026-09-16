"use client";

import { useState } from "react";
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
import { HugeiconsIcon } from "@hugeicons/react";
import { FloppyDiskIcon } from "@hugeicons/core-free-icons";
import { useTextPresetsStore } from "@/text/text-presets-store";
import { readTextStyleValues } from "@/text/text-preset-apply";
import type { TextElement } from "@/timeline";

export function SaveTextPresetButton({ element }: { element: TextElement }) {
	const [isOpen, setIsOpen] = useState(false);
	const [name, setName] = useState("");
	const save = useTextPresetsStore((s) => s.save);

	const handleSave = async () => {
		const trimmed = name.trim();
		if (!trimmed) return;

		await save({
			name: trimmed,
			values: readTextStyleValues({ element }),
		});
		toast.success(`Predefinição "${trimmed}" salva`);
		setIsOpen(false);
		setName("");
	};

	return (
		<>
			<Button
				variant="outline"
				size="sm"
				className="flex-1 gap-1.5"
				onClick={() => setIsOpen(true)}
			>
				<HugeiconsIcon icon={FloppyDiskIcon} className="size-3.5" />
				Salvar
			</Button>
			<Dialog open={isOpen} onOpenChange={setIsOpen}>
				<DialogContent className="max-w-sm">
					<DialogHeader>
						<DialogTitle>Salvar predefinição de texto</DialogTitle>
					</DialogHeader>
					<DialogBody>
						<span className="text-muted-foreground mb-1.5 block text-xs">
							Nome da predefinição
						</span>
						<Input
							value={name}
							onChange={(event) => setName(event.target.value)}
							placeholder="Ex: Headline Hugo"
							onKeyDown={(event) => {
								if (event.key === "Enter") {
									event.preventDefault();
									void handleSave();
								}
							}}
						/>
					</DialogBody>
					<DialogFooter>
						<Button variant="outline" onClick={() => setIsOpen(false)}>
							Cancelar
						</Button>
						<Button onClick={() => void handleSave()} disabled={!name.trim()}>
							Salvar
						</Button>
					</DialogFooter>
				</DialogContent>
			</Dialog>
		</>
	);
}
