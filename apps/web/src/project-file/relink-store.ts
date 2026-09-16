import { create } from "zustand";
import type { PronixCutMediaManifestEntry } from "./schema";

// Transient (session-only, not persisted) hand-off from "Abrir projeto" to
// the editor page: which media the just-opened .pronixcut file references
// that isn't actually present in this browser's storage yet.
interface RelinkStore {
	missingByProject: Record<string, PronixCutMediaManifestEntry[]>;
	setMissing: (params: { projectId: string; entries: PronixCutMediaManifestEntry[] }) => void;
	resolveOne: (params: { projectId: string; mediaId: string }) => void;
	clear: (params: { projectId: string }) => void;
}

export const useRelinkStore = create<RelinkStore>((set) => ({
	missingByProject: {},

	setMissing: ({ projectId, entries }) =>
		set((state) => ({
			missingByProject: { ...state.missingByProject, [projectId]: entries },
		})),

	resolveOne: ({ projectId, mediaId }) =>
		set((state) => {
			const remaining = (state.missingByProject[projectId] ?? []).filter(
				(entry) => entry.id !== mediaId,
			);
			return { missingByProject: { ...state.missingByProject, [projectId]: remaining } };
		}),

	clear: ({ projectId }) =>
		set((state) => {
			const next = { ...state.missingByProject };
			delete next[projectId];
			return { missingByProject: next };
		}),
}));
