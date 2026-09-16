import type { TProject } from "@/project/types";

export const PRONIXCUT_FILE_EXTENSION = ".pronixcut";
export const PRONIXCUT_MIME_TYPE = "application/vnd.pronixcut+json";

// Independent from `TProject.version` (the internal IndexedDB schema
// version, currently 31, migrated by src/services/storage/migrations) —
// this is the on-disk *file* format's own version, so the file container
// itself can evolve (e.g. switch from plain JSON to a zip) without being
// coupled to how many internal project-schema migrations have shipped.
export const PRONIXCUT_FORMAT_VERSION = 1;

export interface PronixCutMediaManifestEntry {
	id: string;
	name: string;
	type: "video" | "image" | "audio";
	size: number;
	lastModified: number;
	width?: number;
	height?: number;
	duration?: number;
	/** Only set for a packaged (.pronixcut + Media/ folder) project — the media file's path relative to the .pronixcut file. */
	packagedPath?: string;
}

export interface PronixCutFile {
	formatVersion: number;
	appVersion: string;
	savedAt: string;
	/** The full, versioned project schema (timeline/tracks/clips/effects/adjustments/etc.) — already comprehensive and JSON-serializable; see @/project/types. */
	project: TProject;
	/** References only — no media bytes — unless this file is part of a packaged project (see @/project-file/package.ts), in which case each entry also carries `packagedPath`. */
	media: PronixCutMediaManifestEntry[];
	/** True when this file's sibling `Media/` folder actually contains the media bytes (produced by "Empacotar projeto"). */
	isPackaged: boolean;
}

export class PronixCutFileError extends Error {}

/** Structural validation only — doesn't run migrations, just confirms this is a well-formed .pronixcut payload before we trust it. */
export function isPronixCutFile(value: unknown): value is PronixCutFile {
	if (!value || typeof value !== "object") return false;
	const candidate = value as Record<string, unknown>;
	return (
		typeof candidate.formatVersion === "number" &&
		typeof candidate.appVersion === "string" &&
		typeof candidate.savedAt === "string" &&
		Boolean(candidate.project) &&
		typeof candidate.project === "object" &&
		Array.isArray(candidate.media)
	);
}
