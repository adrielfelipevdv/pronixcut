"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
	Dialog,
	DialogContent,
	DialogHeader,
	DialogTitle,
	DialogDescription,
	DialogBody,
	DialogFooter,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { HugeiconsIcon } from "@hugeicons/react";
import { Alert02Icon, FolderOpenIcon } from "@hugeicons/core-free-icons";
import { useEditor } from "@/editor/use-editor";
import { useRelinkStore } from "@/project-file/relink-store";
import { pickFileForRelink, relinkMediaAsset } from "@/project-file/relink";

const TYPE_LABEL: Record<string, string> = {
	video: "Vídeo",
	image: "Imagem",
	audio: "Áudio",
};

// A stable empty-array reference — `s.missingByProject[projectId] ?? []`
// would otherwise return a NEW array every render when the key is absent,
// which breaks zustand/React's snapshot-stability check (infinite-loop
// warning, and in dev mode a hard crash of the whole tree).
const EMPTY_MISSING: never[] = [];

export function RelinkDialog({ projectId }: { projectId: string }) {
	const editor = useEditor();
	const missing = useRelinkStore((s) => s.missingByProject[projectId] ?? EMPTY_MISSING);
	const resolveOne = useRelinkStore((s) => s.resolveOne);
	const clear = useRelinkStore((s) => s.clear);
	const [relinkingId, setRelinkingId] = useState<string | null>(null);

	if (missing.length === 0) return null;

	const handleLocate = async (entryId: string) => {
		const entry = missing.find((m) => m.id === entryId);
		if (!entry) return;

		setRelinkingId(entryId);
		try {
			const file = await pickFileForRelink({ type: entry.type });
			if (!file) return;

			await relinkMediaAsset({ projectId, entry, file });
			await editor.media.loadProjectMedia({ projectId });
			resolveOne({ projectId, mediaId: entryId });
			toast.success(`"${entry.name}" relinkado`);
		} catch (error) {
			console.error("Failed to relink media asset:", error);
			toast.error(`Falha ao relinkar "${entry.name}"`);
		} finally {
			setRelinkingId(null);
		}
	};

	return (
		<Dialog open onOpenChange={(open) => !open && clear({ projectId })}>
			<DialogContent className="max-w-md">
				<DialogHeader>
					<DialogTitle className="flex items-center gap-2">
						<HugeiconsIcon icon={Alert02Icon} className="text-caution size-4" />
						Mídia não encontrada
					</DialogTitle>
					<DialogDescription>
						Este projeto referencia arquivos que não estão nesta biblioteca de
						mídia. Localize cada um para restaurar cortes, efeitos e legendas
						sem recriar o clipe.
					</DialogDescription>
				</DialogHeader>
				<DialogBody>
					<ul className="flex flex-col gap-2">
						{missing.map((entry) => (
							<li
								key={entry.id}
								className="border-border bg-accent/40 flex items-center justify-between gap-2 rounded-md border px-3 py-2"
							>
								<div className="flex min-w-0 flex-col">
									<span className="truncate text-sm font-medium">{entry.name}</span>
									<span className="text-muted-foreground text-xs">
										{TYPE_LABEL[entry.type] ?? entry.type}
									</span>
								</div>
								<Button
									variant="outline"
									size="sm"
									className="shrink-0 gap-1.5 text-xs"
									disabled={relinkingId === entry.id}
									onClick={() => handleLocate(entry.id)}
								>
									<HugeiconsIcon icon={FolderOpenIcon} className="size-3.5" />
									Localizar
								</Button>
							</li>
						))}
					</ul>
				</DialogBody>
				<DialogFooter>
					<Button variant="outline" onClick={() => clear({ projectId })}>
						Continuar sem relinkar
					</Button>
				</DialogFooter>
			</DialogContent>
		</Dialog>
	);
}
