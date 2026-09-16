import { create } from "zustand";
import { toast } from "sonner";
import { IndexedDBAdapter } from "@/services/storage/indexeddb-adapter";
import { parseCubeFile, CubeParseError } from "./cube-parser";
import type { LutGrid } from "./types";

export interface ImportedLut {
	id: string;
	name: string;
	size: number;
	/** Flattened as a plain array for structured-clone/IndexedDB friendliness. */
	data: number[];
	createdAt: string;
}

// Imported .cube files are parsed once, then the resulting grid is copied
// into this IndexedDB-backed library (not referenced by the original
// filesystem path) — the browser equivalent of "userData/luts/imported":
// the LUT keeps working even if the source file is moved or deleted.
const adapter = new IndexedDBAdapter<Omit<ImportedLut, "id">>({
	dbName: "pronixcut-luts",
	storeName: "imported",
	version: 1,
});

interface LutLibraryStore {
	luts: ImportedLut[];
	isLoaded: boolean;
	isImporting: boolean;
	load: () => Promise<void>;
	importCubeFile: (params: { name: string; text: string }) => Promise<ImportedLut | null>;
	rename: (params: { id: string; name: string }) => Promise<void>;
	remove: (params: { id: string }) => Promise<void>;
}

async function getAllImported(): Promise<ImportedLut[]> {
	const keys = await adapter.list();
	const records = await Promise.all(
		keys.map(async (key) => {
			const value = await adapter.get(key);
			return value ? ({ id: key, ...value } as ImportedLut) : null;
		}),
	);
	return records.filter((r): r is ImportedLut => r !== null);
}

export const useLutLibraryStore = create<LutLibraryStore>((set, get) => ({
	luts: [],
	isLoaded: false,
	isImporting: false,

	load: async () => {
		if (get().isLoaded) return;
		try {
			const luts = await getAllImported();
			set({ luts, isLoaded: true });
		} catch (error) {
			console.error("Failed to load imported LUTs:", error);
			set({ isLoaded: true });
		}
	},

	importCubeFile: async ({ name, text }) => {
		set({ isImporting: true });
		try {
			const grid = parseCubeFile(text);
			const id = crypto.randomUUID();
			const record: Omit<ImportedLut, "id"> = {
				name,
				size: grid.size,
				data: Array.from(grid.data),
				createdAt: new Date().toISOString(),
			};
			await adapter.set({ key: id, value: record });
			const lut: ImportedLut = { id, ...record };
			set({ luts: [lut, ...get().luts] });
			toast.success(`LUT "${name}" importada`);
			return lut;
		} catch (error) {
			const message =
				error instanceof CubeParseError
					? error.message
					: "Não foi possível ler o arquivo .cube";
			toast.error("Falha ao importar LUT", { description: message });
			console.error("Failed to import .cube file:", error);
			return null;
		} finally {
			set({ isImporting: false });
		}
	},

	rename: async ({ id, name }) => {
		const existing = get().luts.find((l) => l.id === id);
		if (!existing) return;
		const updated = { ...existing, name };
		set({ luts: get().luts.map((l) => (l.id === id ? updated : l)) });
		try {
			const { id: _id, ...value } = updated;
			await adapter.set({ key: id, value });
		} catch (error) {
			console.error("Failed to rename LUT:", error);
			toast.error("Falha ao renomear a LUT");
		}
	},

	remove: async ({ id }) => {
		set({ luts: get().luts.filter((l) => l.id !== id) });
		try {
			await adapter.remove(id);
		} catch (error) {
			console.error("Failed to remove LUT:", error);
			toast.error("Falha ao excluir a LUT");
		}
	},
}));

export function importedLutToGrid(lut: ImportedLut): LutGrid {
	return { size: lut.size, data: Float32Array.from(lut.data) };
}
