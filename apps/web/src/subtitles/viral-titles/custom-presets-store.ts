import { create } from "zustand";
import { toast } from "sonner";
import { IndexedDBAdapter } from "@/services/storage/indexeddb-adapter";
import type { CustomViralTitlePreset } from "./types";
import type { ParamValues } from "@/params";

interface ViralTitlePresetsData {
	presets: CustomViralTitlePreset[];
}

// "Meus títulos" — persisted viral-title presets, same IndexedDB pattern as
// "Meus efeitos" (effects/color-grade/custom-presets-store.ts) and "Meus
// estilos" (text/text-presets-store.ts): survives closing/reopening
// PronixCut, own DB/store so it can't destabilize core project storage.
const adapter = new IndexedDBAdapter<ViralTitlePresetsData>({
	dbName: "pronixcut-viral-title-presets",
	storeName: "viral-title-presets",
	version: 1,
});
const STORE_KEY = "presets";

interface ViralTitlePresetsStore {
	presets: CustomViralTitlePreset[];
	isLoaded: boolean;
	load: () => Promise<void>;
	save: (params: {
		name: string;
		values: ParamValues;
	}) => Promise<CustomViralTitlePreset>;
	remove: (id: string) => Promise<void>;
}

async function persist(presets: CustomViralTitlePreset[]): Promise<void> {
	await adapter.set({ key: STORE_KEY, value: { presets } });
}

export const useCustomViralTitlePresetsStore = create<ViralTitlePresetsStore>(
	(set, get) => ({
		presets: [],
		isLoaded: false,

		load: async () => {
			if (get().isLoaded) return;
			try {
				const data = await adapter.get(STORE_KEY);
				set({ presets: data?.presets ?? [], isLoaded: true });
			} catch (error) {
				console.error("Failed to load viral title presets:", error);
				set({ isLoaded: true });
			}
		},

		save: async ({ name, values }) => {
			const preset: CustomViralTitlePreset = {
				id: crypto.randomUUID(),
				name,
				values,
				createdAt: new Date().toISOString(),
			};
			const updated = [preset, ...get().presets];
			set({ presets: updated });
			try {
				await persist(updated);
			} catch (error) {
				console.error("Failed to save viral title preset:", error);
				toast.error("Falha ao salvar o título viral");
			}
			return preset;
		},

		remove: async (id) => {
			const updated = get().presets.filter((preset) => preset.id !== id);
			set({ presets: updated });
			try {
				await persist(updated);
			} catch (error) {
				console.error("Failed to remove viral title preset:", error);
				toast.error("Falha ao excluir o título viral");
			}
		},
	}),
);
