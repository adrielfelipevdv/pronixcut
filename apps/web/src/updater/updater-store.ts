import { create } from "zustand";
import type { UpdaterStatus } from "./types";

interface UpdaterState {
	status: UpdaterStatus;
	currentVersion: string | null;
	/** Version the user clicked "Depois" on — suppresses the banner for that
	 * specific version only, for the rest of this session. A later, newer
	 * version still shows normally. */
	dismissedVersion: string | null;
	setStatus: (status: UpdaterStatus) => void;
	setCurrentVersion: (version: string) => void;
	dismiss: (version: string) => void;
}

export const useUpdaterStore = create<UpdaterState>((set) => ({
	status: { state: "idle" },
	currentVersion: null,
	dismissedVersion: null,
	setStatus: (status) => set({ status }),
	setCurrentVersion: (version) => set({ currentVersion: version }),
	dismiss: (version) => set({ dismissedVersion: version }),
}));
