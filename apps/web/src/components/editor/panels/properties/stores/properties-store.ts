import { create } from "zustand";
import { persist } from "zustand/middleware";

interface PropertiesState {
	activeTabPerType: Record<string, string>;
	setActiveTab: (args: { elementType: string; tabId: string }) => void;
	isTransformScaleLocked: boolean;
	setTransformScaleLocked: (args: { locked: boolean }) => void;
	inspectorCollapsed: boolean;
	toggleInspectorCollapsed: () => void;
}

export const usePropertiesStore = create<PropertiesState>()(
	persist(
		(set) => ({
			activeTabPerType: {},
			setActiveTab: ({ elementType, tabId }) =>
				set((state) => ({
					activeTabPerType: { ...state.activeTabPerType, [elementType]: tabId },
				})),
			isTransformScaleLocked: false,
			setTransformScaleLocked: ({ locked }) =>
				set({ isTransformScaleLocked: locked }),
			inspectorCollapsed: false,
			toggleInspectorCollapsed: () =>
				set((state) => ({ inspectorCollapsed: !state.inspectorCollapsed })),
		}),
		{
			name: "inspector-panel",
			partialize: (state) => ({
				inspectorCollapsed: state.inspectorCollapsed,
			}),
		},
	),
);
