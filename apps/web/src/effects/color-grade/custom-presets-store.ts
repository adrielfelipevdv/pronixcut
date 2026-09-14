import { create } from "zustand";
import { toast } from "sonner";
import { IndexedDBAdapter } from "@/services/storage/indexeddb-adapter";
import { COLOR_GRADE_EFFECT_TYPE } from "./definition";
import type { ColorGradeValues } from "./params";

export interface CustomColorGradePreset {
	id: string;
	name: string;
	values: ColorGradeValues;
	createdAt: string;
}

interface CustomPresetsData {
	presets: CustomColorGradePreset[];
}

// Cross-project, persisted "Meus efeitos" — same IndexedDB pattern as saved
// sounds (services/storage/service.ts), kept in its own store so this
// addition can't destabilize the core project/media storage service.
const adapter = new IndexedDBAdapter<CustomPresetsData>({
	dbName: "pronixcut-custom-effects",
	storeName: "color-grade-presets",
	version: 1,
});
const STORE_KEY = "presets";

interface CustomEffectPresetsStore {
	presets: CustomColorGradePreset[];
	isLoaded: boolean;
	load: () => Promise<void>;
	save: (params: { name: string; values: ColorGradeValues }) => Promise<CustomColorGradePreset>;
	remove: (id: string) => Promise<void>;
}

export const useCustomEffectPresetsStore = create<CustomEffectPresetsStore>((set, get) => ({
	presets: [],
	isLoaded: false,

	load: async () => {
		if (get().isLoaded) return;
		try {
			const data = await adapter.get(STORE_KEY);
			set({ presets: data?.presets ?? [], isLoaded: true });
		} catch (error) {
			console.error("Failed to load custom effect presets:", error);
			set({ isLoaded: true });
		}
	},

	save: async ({ name, values }) => {
		const preset: CustomColorGradePreset = {
			id: crypto.randomUUID(),
			name,
			values,
			createdAt: new Date().toISOString(),
		};
		const updated = [preset, ...get().presets];
		set({ presets: updated });
		try {
			await adapter.set({ key: STORE_KEY, value: { presets: updated } });
		} catch (error) {
			console.error("Failed to save custom effect preset:", error);
			toast.error("Falha ao salvar o efeito");
		}
		return preset;
	},

	remove: async (id) => {
		const updated = get().presets.filter((preset) => preset.id !== id);
		set({ presets: updated });
		try {
			await adapter.set({ key: STORE_KEY, value: { presets: updated } });
		} catch (error) {
			console.error("Failed to remove custom effect preset:", error);
			toast.error("Falha ao remover o efeito");
		}
	},
}));

export { COLOR_GRADE_EFFECT_TYPE };
