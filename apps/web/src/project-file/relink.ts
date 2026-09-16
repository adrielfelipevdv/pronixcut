import { storageService } from "@/services/storage/service";
import type { MediaAsset } from "@/media/types";
import type { PronixCutMediaManifestEntry } from "./schema";

const ACCEPT_BY_TYPE: Record<PronixCutMediaManifestEntry["type"], string> = {
	video: "video/*",
	image: "image/*",
	audio: "audio/*",
};

export function acceptForMediaType({
	type,
}: {
	type: PronixCutMediaManifestEntry["type"];
}): string {
	return ACCEPT_BY_TYPE[type];
}

/** Re-associates a newly-picked file with an EXISTING mediaId, so every clip already referencing it (trims, effects, adjustments, captions) keeps working — nothing about the clip is recreated. */
export async function relinkMediaAsset({
	projectId,
	entry,
	file,
}: {
	projectId: string;
	entry: PronixCutMediaManifestEntry;
	file: File;
}): Promise<void> {
	const asset: MediaAsset = {
		id: entry.id,
		name: entry.name,
		type: entry.type,
		file,
		width: entry.width,
		height: entry.height,
		duration: entry.duration,
	};
	await storageService.saveMediaAsset({ projectId, mediaAsset: asset });
}

export function pickFileForRelink({
	type,
}: {
	type: PronixCutMediaManifestEntry["type"];
}): Promise<File | null> {
	return new Promise((resolve) => {
		const input = document.createElement("input");
		input.type = "file";
		input.accept = acceptForMediaType({ type });
		input.onchange = () => resolve(input.files?.[0] ?? null);
		input.click();
	});
}
