import { toast } from "sonner";
import { storageService } from "@/services/storage/service";
import {
	isPronixCutFile,
	PronixCutFileError,
	PRONIXCUT_FILE_EXTENSION,
	PRONIXCUT_MIME_TYPE,
	type PronixCutFile,
	type PronixCutMediaManifestEntry,
} from "./schema";
import { reviveProjectDates } from "./serialize";
import { rememberProjectFileHandle } from "./handle-store";
import { isFileSystemAccessSupported } from "@/export/save-location";

export interface OpenProjectFileResult {
	success: boolean;
	cancelled?: boolean;
	error?: string;
	projectId?: string;
	missingMedia?: PronixCutMediaManifestEntry[];
}

function parsePronixCutFile({ text }: { text: string }): PronixCutFile {
	let parsed: unknown;
	try {
		parsed = JSON.parse(text);
	} catch {
		throw new PronixCutFileError("Arquivo .pronixcut inválido (JSON malformado)");
	}
	if (!isPronixCutFile(parsed)) {
		throw new PronixCutFileError("Arquivo .pronixcut inválido ou de formato desconhecido");
	}
	return parsed;
}

/**
 * Imports a parsed `.pronixcut` payload into local project storage — the
 * project's OWN id (from the file) is reused rather than generated fresh,
 * so opening a file that was saved from THIS browser/machine reconnects to
 * the media already sitting in this project's OPFS store; a truly new
 * machine (or a project whose media was never here) instead surfaces every
 * asset as missing, which the relink flow then handles per-asset.
 */
async function importPronixCutFile({
	file,
	fileHandle,
}: {
	file: PronixCutFile;
	fileHandle?: FileSystemFileHandle;
}): Promise<OpenProjectFileResult> {
	const project = reviveProjectDates({ project: file.project });

	await storageService.saveProject({ project });

	if (fileHandle) {
		await rememberProjectFileHandle({ projectId: project.metadata.id, handle: fileHandle });
	}

	const existingAssets = await storageService.loadAllMediaAssets({
		projectId: project.metadata.id,
	});
	const existingIds = new Set(existingAssets.map((asset) => asset.id));
	const missingMedia = file.media.filter((entry) => !existingIds.has(entry.id));

	return { success: true, projectId: project.metadata.id, missingMedia };
}

/** "Abrir projeto" — native file picker (File System Access API where available, `<input type=file>` fallback), parses, validates, and imports the project. */
export async function openProjectFile(): Promise<OpenProjectFileResult> {
	if (isFileSystemAccessSupported() && "showOpenFilePicker" in window) {
		try {
			const [handle] = await window.showOpenFilePicker({
				multiple: false,
				types: [
					{
						description: "Projeto PronixCut",
						accept: { [PRONIXCUT_MIME_TYPE]: [PRONIXCUT_FILE_EXTENSION] },
					},
				],
			});
			const fileObject = await handle.getFile();
			const text = await fileObject.text();
			const parsed = parsePronixCutFile({ text });
			return await importPronixCutFile({ file: parsed, fileHandle: handle });
		} catch (error) {
			if (error instanceof DOMException && error.name === "AbortError") {
				return { success: false, cancelled: true };
			}
			return handleOpenError(error);
		}
	}

	return openProjectFileViaInput();
}

function openProjectFileViaInput(): Promise<OpenProjectFileResult> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = PRONIXCUT_FILE_EXTENSION;
		input.onchange = async () => {
			const fileObject = input.files?.[0];
			if (!fileObject) {
				resolve({ success: false, cancelled: true });
				return;
			}
			try {
				const text = await fileObject.text();
				const parsed = parsePronixCutFile({ text });
				resolve(await importPronixCutFile({ file: parsed }));
			} catch (error) {
				resolve(handleOpenError(error));
			}
		};
		input.click();
	});
}

function handleOpenError(error: unknown): OpenProjectFileResult {
	console.error("Failed to open project file:", error);
	const message =
		error instanceof PronixCutFileError
			? error.message
			: "Não foi possível abrir o arquivo de projeto";
	toast.error("Falha ao abrir projeto", { description: message });
	return { success: false, error: message };
}
