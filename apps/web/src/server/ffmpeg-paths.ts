import fs from "node:fs";

// Resolves real, working ffmpeg/ffprobe binaries in both dev and packaged
// builds, without depending on the end user having either installed or on
// PATH (see apps/electron/main.js and scripts/prepare-standalone.js for how
// PRONIX_FFMPEG_PATH/PRONIX_FFPROBE_PATH get set in a packaged app — they
// point at binaries copied out of the ffmpeg-static/ffprobe-static npm
// packages at package time, not at anything on the end user's machine).
//
// Distribution note (see also RELEASE_READINESS_REPORT.md): the ffmpeg
// binary served by `ffmpeg-static` is gyan.dev's Windows "essentials"
// build, GPL v3 (bundles libx264/libx265/etc). PronixCut only ever invokes
// it as a separate child process (never links against it), which is the
// standard "mere aggregation" arrangement GPL software is commonly shipped
// under alongside proprietary apps — but this has not been reviewed by a
// lawyer and should be before public distribution.

function isUsableBinary(candidate: string | null | undefined): candidate is string {
	if (!candidate) return false;
	try {
		if (!fs.existsSync(candidate)) return false;
		if (process.platform !== "win32") {
			try {
				fs.chmodSync(candidate, 0o755);
			} catch {
				// best-effort; if this fails, spawn() will surface the real error
			}
		}
		return true;
	} catch {
		return false;
	}
}

function resolveFromPackage(loader: () => string | null | undefined): string | null {
	try {
		const resolved = loader();
		return isUsableBinary(resolved) ? resolved : null;
	} catch {
		return null;
	}
}

let cachedFfmpegPath: string | null = null;
let cachedFfprobePath: string | null = null;

export function getFfmpegPath(): string {
	if (cachedFfmpegPath) return cachedFfmpegPath;

	const fromEnv = process.env.PRONIX_FFMPEG_PATH?.trim();
	if (isUsableBinary(fromEnv)) {
		cachedFfmpegPath = fromEnv;
		return fromEnv;
	}

	const fromPackage = resolveFromPackage(() => {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const ffmpegStatic: string | null = require("ffmpeg-static");
		return ffmpegStatic;
	});
	if (fromPackage) {
		cachedFfmpegPath = fromPackage;
		return fromPackage;
	}

	cachedFfmpegPath = "ffmpeg";
	return cachedFfmpegPath;
}

export function getFfprobePath(): string {
	if (cachedFfprobePath) return cachedFfprobePath;

	const fromEnv = process.env.PRONIX_FFPROBE_PATH?.trim();
	if (isUsableBinary(fromEnv)) {
		cachedFfprobePath = fromEnv;
		return fromEnv;
	}

	const fromPackage = resolveFromPackage(() => {
		// eslint-disable-next-line @typescript-eslint/no-require-imports
		const ffprobeStatic: { path: string } | null = require("ffprobe-static");
		return ffprobeStatic?.path ?? null;
	});
	if (fromPackage) {
		cachedFfprobePath = fromPackage;
		return fromPackage;
	}

	cachedFfprobePath = "ffprobe";
	return cachedFfprobePath;
}
