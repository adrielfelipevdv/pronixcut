import { create } from "zustand";
import { persist } from "zustand/middleware";

interface SidePreviewState {
	isEnabled: boolean;
	toggle: () => void;
	setEnabled: (value: boolean) => void;
}

// Purely a UI display toggle — never touches project settings, canvasSize,
// or the render tree. The 16:9 pane is a read-only mirror of the real
// preview canvas (see side-preview.tsx), so turning this on/off can never
// change the project's actual aspect ratio or exported output.
export const useSidePreviewStore = create<SidePreviewState>()(
	persist(
		(set) => ({
			isEnabled: false,
			toggle: () => set((state) => ({ isEnabled: !state.isEnabled })),
			setEnabled: (value) => set({ isEnabled: value }),
		}),
		{ name: "pronixcut-side-preview" },
	),
);
