import { toast } from "sonner";
import type { TProject } from "@/project/types";
import type { MediaAsset } from "@/media/types";
import { buildPronixCutFile, serializePronixCutFile } from "./serialize";
import { PRONIXCUT_FILE_EXTENSION, PRONIXCUT_MIME_TYPE } from "./schema";
import {
	ensureWritePermission,
	getRememberedProjectFileHandle,
	rememberProjectFileHandle,
} from "./handle-store";
import { isFileSystemAccessSupported } from "@/export/save-location";

export interface SaveProjectFileResult {
	success: boolean;
	cancelled?: boolean;
	filename?: string;
	error?: string;
}

function suggestedFileName({ project }: { project: TProject }): string {
	const safeName = project.metadata.name.replace(/[<>:"/\\|?*]/g, "-").trim() || "Projeto Pronix";
	return `${safeName}${PRONIXCUT_FILE_EXTENSION}`;
}

async function writeTextToHandle({
	handle,
	text,
}: {
	handle: FileSystemFileHandle;
	text: string;
}): Promise<void> {
	const writable = await handle.createWritable();
	await writable.write(text);
	await writable.close();
}

function downloadTextFile({ text, filename }: { text: string; filename: string }): void {
	const blob = new Blob([text], { type: PRONIXCUT_MIME_TYPE });
	const url = URL.createObjectURL(blob);
	const link = document.createElement("a");
	link.href = url;
	link.download = filename;
	document.body.appendChild(link);
	link.click();
	document.body.removeChild(link);
	URL.revokeObjectURL(url);
}

/** "Salvar como…" — always prompts for a new location and remembers it for future silent `Ctrl+S` writes. */
export async function saveProjectFileAs({
	project,
	mediaAssets,
}: {
	project: TProject;
	mediaAssets: MediaAsset[];
}): Promise<SaveProjectFileResult> {
	const file = await buildPronixCutFile({ project, mediaAssets });
	const text = serializePronixCutFile({ file });
	const filename = suggestedFileName({ project });

	if (!isFileSystemAccessSupported() || !("showSaveFilePicker" in window)) {
		downloadTextFile({ text, filename });
		return { success: true, filename };
	}

	try {
		const handle = await window.showSaveFilePicker({
			suggestedName: filename,
			types: [
				{
					description: "Projeto PronixCut",
					accept: { [PRONIXCUT_MIME_TYPE]: [PRONIXCUT_FILE_EXTENSION] },
				},
			],
		});
		await writeTextToHandle({ handle, text });
		await rememberProjectFileHandle({ projectId: project.metadata.id, handle });
		toast.success(`Projeto salvo em "${handle.name}"`);
		return { success: true, filename: handle.name };
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") {
			return { success: false, cancelled: true };
		}
		console.error("Failed to save project file:", error);
		toast.error("Falha ao salvar o projeto");
		return { success: false, error: error instanceof Error ? error.message : "Erro desconhecido" };
	}
}

/**
 * `Ctrl+S` — writes silently to the last location this project was saved to
 * (via its remembered `FileSystemFileHandle`). Falls back to "Salvar
 * como…" the first time, or if the remembered handle is no longer usable.
 */
export async function saveProjectFile({
	project,
	mediaAssets,
}: {
	project: TProject;
	mediaAssets: MediaAsset[];
}): Promise<SaveProjectFileResult> {
	const handle = await getRememberedProjectFileHandle({ projectId: project.metadata.id });
	if (!handle) {
		return saveProjectFileAs({ project, mediaAssets });
	}

	try {
		const hasPermission = await ensureWritePermission({ handle });
		if (!hasPermission) {
			toast.error("Permissão de escrita negada", {
				description: "Escolha o local novamente.",
			});
			return saveProjectFileAs({ project, mediaAssets });
		}

		const file = await buildPronixCutFile({ project, mediaAssets });
		const text = serializePronixCutFile({ file });
		await writeTextToHandle({ handle, text });
		toast.success(`Projeto salvo em "${handle.name}"`);
		return { success: true, filename: handle.name };
	} catch (error) {
		console.error("Failed to save to remembered project file handle:", error);
		return saveProjectFileAs({ project, mediaAssets });
	}
}
