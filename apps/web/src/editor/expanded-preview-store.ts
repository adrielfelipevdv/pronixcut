import { create } from "zustand";
import { persist } from "zustand/middleware";

// A pure layout preference — which panel is bigger — never touched:
// resolution, aspect ratio, export settings, or element positions. Toggling
// only resizes the existing resizable panels (see EditorLayout), so it's
// trivially reversible.
interface ExpandedPreviewState {
	isExpanded: boolean;
	toggle: () => void;
	setExpanded: (value: boolean) => void;
}

export const useExpandedPreviewStore = create<ExpandedPreviewState>()(
	persist(
		(set) => ({
			isExpanded: false,
			toggle: () => set((state) => ({ isExpanded: !state.isExpanded })),
			setExpanded: (value) => set({ isExpanded: value }),
		}),
		{ name: "pronixcut-expanded-preview" },
	),
);
