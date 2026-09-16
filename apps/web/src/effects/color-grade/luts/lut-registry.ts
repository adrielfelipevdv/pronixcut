import { GENERATED_LUT_SPECS, getGeneratedLutGrid } from "./generated-luts";
import { importedLutToGrid, useLutLibraryStore } from "./lut-library-store";
import type { LutGrid } from "./types";

export interface LutListEntry {
	id: string;
	name: string;
	kind: "builtin" | "imported";
}

export function listBuiltinLuts(): LutListEntry[] {
	return GENERATED_LUT_SPECS.map((spec) => ({
		id: spec.id,
		name: spec.name,
		kind: "builtin" as const,
	}));
}

export function listImportedLuts(): LutListEntry[] {
	return useLutLibraryStore
		.getState()
		.luts.map((lut) => ({ id: lut.id, name: lut.name, kind: "imported" as const }));
}

/** Resolves a LUT id (builtin or imported) to its grid data — used by the GPU pass and by thumbnail rendering. Returns null for "no LUT" / unknown id. */
export function resolveLutGrid({ id }: { id: string | null }): LutGrid | null {
	if (!id) return null;
	const builtin = getGeneratedLutGrid({ id });
	if (builtin) return builtin;
	const imported = useLutLibraryStore.getState().luts.find((lut) => lut.id === id);
	return imported ? importedLutToGrid(imported) : null;
}
