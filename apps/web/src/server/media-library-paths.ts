import fs from "node:fs";
import os from "node:os";
import path from "node:path";

// Node-only paths for PronixCut's cross-project local media library
// (Sounds & effects imports, etc). This is server-side storage, distinct
// from the per-project media stored client-side via IndexedDB/OPFS
// (services/storage/service.ts) — it needs to be a real, fetchable HTTP
// resource (see media/audio.ts's fetch(element.sourceUrl) at playback time),
// which a browser-side blob: URL cannot durably provide across app restarts.
//
// PRONIX_USER_DATA_DIR is set by the Electron main process to
// app.getPath("userData") (apps/electron/main.js). Outside Electron (e.g.
// running the web app standalone in a browser during development) this
// falls back to a per-user folder under the home directory.

export function getAppDataRoot(): string {
	const fromEnv = process.env.PRONIX_USER_DATA_DIR?.trim();
	return fromEnv || path.join(os.homedir(), ".pronixcut");
}

export function getAudioLibraryDir(): string {
	const dir = path.join(getAppDataRoot(), "media-library", "audio");
	fs.mkdirSync(dir, { recursive: true });
	return dir;
}

export function getAudioLibraryIndexPath(): string {
	return path.join(getAudioLibraryDir(), "index.json");
}
