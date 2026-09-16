import { create } from "zustand";
import {
	ADJUSTMENT_DEFAULTS,
	type AdjustmentSliderKey,
	type AdjustmentValues,
} from "./types";

// Panel-level state for the Ajustes tab. Not yet wired into the render
// pipeline — the base (structure, sync, reset) is deliberately built first
// so a future pass can connect these values to the selected element/project
// without reshaping the UI.
interface AdjustmentsStore {
	values: AdjustmentValues;
	setValue: <K extends AdjustmentSliderKey>(key: K, value: AdjustmentValues[K]) => void;
	setAutoCrop: (value: boolean) => void;
	reset: () => void;
}

export const useAdjustmentsStore = create<AdjustmentsStore>((set) => ({
	values: { ...ADJUSTMENT_DEFAULTS },

	setValue: (key, value) =>
		set((state) => ({ values: { ...state.values, [key]: value } })),

	setAutoCrop: (value) =>
		set((state) => ({
			values: { ...state.values, stabilizationAutoCrop: value },
		})),

	reset: () => set({ values: { ...ADJUSTMENT_DEFAULTS } }),
}));
