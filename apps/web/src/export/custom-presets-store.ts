import { create } from "zustand";
import { toast } from "sonner";
import { IndexedDBAdapter } from "@/services/storage/indexeddb-adapter";
import type { ExportOptions } from "./index";

export interface CustomExportPreset {
	id: string;
	name: string;
	settings: Omit<ExportOptions, "filename">;
	createdAt: string;
}

const adapter = new IndexedDBAdapter<Omit<CustomExportPreset, "id">>({
	dbName: "pronixcut-export-presets",
	storeName: "presets",
	version: 1,
});

interface CustomExportPresetsStore {
	presets: CustomExportPreset[];
	isLoaded: boolean;
	load: () => Promise<void>;
	save: (params: { name: string; settings: Omit<ExportOptions, "filename"> }) => Promise<void>;
	remove: (id: string) => Promise<void>;
}

async function getAllPresets(): Promise<CustomExportPreset[]> {
	const keys = await adapter.list();
	const records = await Promise.all(
		keys.map(async (key) => {
			const value = await adapter.get(key);
			return value ? ({ id: key, ...value } as CustomExportPreset) : null;
		}),
	);
	return records.filter((r): r is CustomExportPreset => r !== null);
}

export const useCustomExportPresetsStore = create<CustomExportPresetsStore>((set, get) => ({
	presets: [],
	isLoaded: false,

	load: async () => {
		if (get().isLoaded) return;
		try {
			const presets = await getAllPresets();
			set({ presets, isLoaded: true });
		} catch (error) {
			console.error("Failed to load export presets:", error);
			set({ isLoaded: true });
		}
	},

	save: async ({ name, settings }) => {
		const id = crypto.randomUUID();
		const record: Omit<CustomExportPreset, "id"> = {
			name,
			settings,
			createdAt: new Date().toISOString(),
		};
		try {
			await adapter.set({ key: id, value: record });
			set({ presets: [{ id, ...record }, ...get().presets] });
			toast.success(`Predefinição "${name}" salva`);
		} catch (error) {
			console.error("Failed to save export preset:", error);
			toast.error("Falha ao salvar predefinição");
		}
	},

	remove: async (id) => {
		set({ presets: get().presets.filter((p) => p.id !== id) });
		try {
			await adapter.remove(id);
		} catch (error) {
			console.error("Failed to remove export preset:", error);
			toast.error("Falha ao excluir predefinição");
		}
	},
}));
