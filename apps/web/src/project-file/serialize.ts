import type { TProject } from "@/project/types";
import type { MediaAsset } from "@/media/types";
import { isRunningInElectron } from "@/updater/types";
import {
	PRONIXCUT_FORMAT_VERSION,
	type PronixCutFile,
	type PronixCutMediaManifestEntry,
} from "./schema";

async function getAppVersion(): Promise<string> {
	if (isRunningInElectron() && window.pronixApp) {
		try {
			return await window.pronixApp.getVersion();
		} catch {
			// fall through to the web fallback below
		}
	}
	return "web";
}

export function buildMediaManifest({
	mediaAssets,
}: {
	mediaAssets: MediaAsset[];
}): PronixCutMediaManifestEntry[] {
	return mediaAssets
		.filter((asset) => !asset.ephemeral)
		.map((asset) => ({
			id: asset.id,
			name: asset.name,
			type: asset.type,
			size: asset.file.size,
			lastModified: asset.file.lastModified,
			width: asset.width,
			height: asset.height,
			duration: asset.duration,
		}));
}

/**
 * Builds the full .pronixcut payload from the live project — `TProject`
 * (metadata/scenes/tracks/clips/effects/settings) is already a clean,
 * comprehensive, JSON-serializable schema (see @/project/types), so this
 * mostly just wraps it with a versioned manifest. No media bytes, no DOM
 * refs, no recomputable cache (waveform peaks, thumbnails) — those aren't
 * part of `TProject` to begin with.
 */
export async function buildPronixCutFile({
	project,
	mediaAssets,
}: {
	project: TProject;
	mediaAssets: MediaAsset[];
}): Promise<PronixCutFile> {
	return {
		formatVersion: PRONIXCUT_FORMAT_VERSION,
		appVersion: await getAppVersion(),
		savedAt: new Date().toISOString(),
		project,
		media: buildMediaManifest({ mediaAssets }),
		isPackaged: false,
	};
}

export function serializePronixCutFile({ file }: { file: PronixCutFile }): string {
	return JSON.stringify(file, null, 2);
}

/** Reverses `JSON.stringify`'s Date -> ISO-string coercion for every timestamp `TProject` expects as a real `Date` — both the project metadata AND each scene's own `createdAt`/`updatedAt` (see @/timeline/types `TScene`). */
export function reviveProjectDates({ project }: { project: TProject }): TProject {
	return {
		...project,
		metadata: {
			...project.metadata,
			createdAt: new Date(project.metadata.createdAt),
			updatedAt: new Date(project.metadata.updatedAt),
		},
		scenes: project.scenes.map((scene) => ({
			...scene,
			createdAt: new Date(scene.createdAt),
			updatedAt: new Date(scene.updatedAt),
		})),
	};
}
