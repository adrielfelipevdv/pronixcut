import { toast } from "sonner";

// The native Windows folder picker itself isn't reachable from a normal web
// page — but this app runs inside Electron's Chromium, which DOES implement
// the File System Access API (`showDirectoryPicker`), giving a real native
// "choose a folder" dialog without needing new Electron IPC. Where it's
// unavailable (older browsers), callers fall back to the existing browser
// download, so nothing is faked either way.

export function isFileSystemAccessSupported(): boolean {
	return typeof window !== "undefined" && "showDirectoryPicker" in window;
}

export async function pickExportSaveDirectory(): Promise<FileSystemDirectoryHandle | null> {
	if (!isFileSystemAccessSupported()) {
		toast.error("Seleção de pasta não é suportada neste navegador", {
			description: "O arquivo será salvo na pasta de downloads padrão.",
		});
		return null;
	}
	try {
		return await window.showDirectoryPicker({ mode: "readwrite" });
	} catch (error) {
		if (error instanceof DOMException && error.name === "AbortError") return null;
		console.error("Failed to pick export save directory:", error);
		toast.error("Não foi possível selecionar a pasta");
		return null;
	}
}

/** Returns true if the file was actually written to `directory`; false means the caller should fall back to a normal download. */
export async function writeExportFileToDirectory({
	directory,
	filename,
	buffer,
}: {
	directory: FileSystemDirectoryHandle;
	filename: string;
	buffer: ArrayBuffer;
}): Promise<boolean> {
	try {
		const permission = await directory.requestPermission?.({ mode: "readwrite" });
		if (permission && permission !== "granted") {
			toast.error("Permissão de escrita negada para a pasta selecionada");
			return false;
		}

		const fileHandle = await directory.getFileHandle(filename, { create: true });
		const writable = await fileHandle.createWritable();
		await writable.write(buffer);
		await writable.close();
		toast.success(`Salvo em "${directory.name}/${filename}"`);
		return true;
	} catch (error) {
		console.error("Failed to write export file to directory:", error);
		toast.error("Falha ao salvar na pasta selecionada", {
			description: "O arquivo será baixado normalmente.",
		});
		return false;
	}
}
