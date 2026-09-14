import { create } from "zustand";
import { toast } from "sonner";
import { IndexedDBAdapter } from "@/services/storage/indexeddb-adapter";
import type { ParamValues } from "@/params";

export interface TextPreset {
	id: string;
	name: string;
	values: ParamValues;
	createdAt: string;
}

interface TextPresetsData {
	presets: TextPreset[];
}

// "Meus estilos" — persisted text style presets, same IndexedDB pattern as
// "Meus efeitos" (effects/color-grade/custom-presets-store.ts): survives
// closing and reopening PronixCut, kept in its own DB/store so it can't
// destabilize core project storage.
const adapter = new IndexedDBAdapter<TextPresetsData>({
	dbName: "pronixcut-text-presets",
	storeName: "text-presets",
	version: 1,
});
const STORE_KEY = "presets";

interface TextPresetsStore {
	presets: TextPreset[];
	isLoaded: boolean;
	load: () => Promise<void>;
	save: (params: { name: string; values: ParamValues }) => Promise<TextPreset>;
	rename: (params: { id: string; name: string }) => Promise<void>;
	duplicate: (id: string) => Promise<TextPreset | null>;
	remove: (id: string) => Promise<void>;
}

async function persist(presets: TextPreset[]): Promise<void> {
	await adapter.set({ key: STORE_KEY, value: { presets } });
}

export const useTextPresetsStore = create<TextPresetsStore>((set, get) => ({
	presets: [],
	isLoaded: false,

	load: async () => {
		if (get().isLoaded) return;
		try {
			const data = await adapter.get(STORE_KEY);
			set({ presets: data?.presets ?? [], isLoaded: true });
		} catch (error) {
			console.error("Failed to load text presets:", error);
			set({ isLoaded: true });
		}
	},

	save: async ({ name, values }) => {
		const preset: TextPreset = {
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
			console.error("Failed to save text preset:", error);
			toast.error("Falha ao salvar a predefinição");
		}
		return preset;
	},

	rename: async ({ id, name }) => {
		const updated = get().presets.map((preset) =>
			preset.id === id ? { ...preset, name } : preset,
		);
		set({ presets: updated });
		try {
			await persist(updated);
		} catch (error) {
			console.error("Failed to rename text preset:", error);
			toast.error("Falha ao renomear a predefinição");
		}
	},

	duplicate: async (id) => {
		const source = get().presets.find((preset) => preset.id === id);
		if (!source) return null;
		const copy: TextPreset = {
			id: crypto.randomUUID(),
			name: `${source.name} (cópia)`,
			values: { ...source.values },
			createdAt: new Date().toISOString(),
		};
		const updated = [copy, ...get().presets];
		set({ presets: updated });
		try {
			await persist(updated);
		} catch (error) {
			console.error("Failed to duplicate text preset:", error);
			toast.error("Falha ao duplicar a predefinição");
		}
		return copy;
	},

	remove: async (id) => {
		const updated = get().presets.filter((preset) => preset.id !== id);
		set({ presets: updated });
		try {
			await persist(updated);
		} catch (error) {
			console.error("Failed to remove text preset:", error);
			toast.error("Falha ao excluir a predefinição");
		}
	},
}));
