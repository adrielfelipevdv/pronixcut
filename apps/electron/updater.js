const { app, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");
const fs = require("node:fs");
const path = require("node:path");

// Written right before the app quits to apply a silently-installed update,
// and checked by main.js on the NEXT launch so it can show "Atualizando o
// PronixCut..." instead of the ordinary blank-window startup gap. Deleted as
// soon as main.js has read it, so a crash mid-update can't wedge every
// future launch into thinking it's mid-update forever. Computed lazily
// (not at module load) since `app.getPath` is only meant to be called once
// the app is ready.
function getPendingUpdateMarkerPath() {
	return path.join(app.getPath("userData"), "pending-update.json");
}

// Silent, well after launch — never competes with startup for network/CPU.
const CHECK_DELAY_AFTER_START_MS = 15_000;
// Re-check periodically, but nowhere near often enough to hammer GitHub.
const RECHECK_INTERVAL_MS = 4 * 60 * 60 * 1000;
// If the renderer never acks the pre-install save flush (e.g. no project
// open, or it's wedged), install anyway after this — an update must never
// be blocked forever by a renderer that didn't respond.
const FLUSH_TIMEOUT_MS = 8_000;

/**
 * Wires electron-updater into the given window. A no-op in dev/unpackaged
 * runs — there is nothing to update, and pointing an unpackaged app at a
 * real release feed only produces confusing "update available" noise.
 *
 * Returns a cleanup function (clears the startup/interval timers) or null
 * when disabled.
 */
function setupAutoUpdater({ mainWindow, log }) {
	if (!app.isPackaged) {
		log("[updater] disabled (not a packaged build)");
		return null;
	}

	autoUpdater.autoDownload = true;
	// We decide exactly when to install (user clicks "Atualizar e reiniciar"),
	// never as a side effect of the user quitting the app normally.
	autoUpdater.autoInstallOnAppQuit = false;
	autoUpdater.logger = {
		info: (message) => log(`[updater] ${message}`),
		warn: (message) => log(`[updater][warn] ${message}`),
		error: (message) => log(`[updater][error] ${message}`),
		debug: () => {},
	};

	const send = (status) => {
		if (mainWindow && !mainWindow.isDestroyed()) {
			mainWindow.webContents.send("updater:status", status);
		}
	};

	autoUpdater.on("checking-for-update", () => send({ state: "checking" }));
	autoUpdater.on("update-available", (info) =>
		send({
			state: "updateAvailable",
			version: info.version,
			releaseNotes:
				typeof info.releaseNotes === "string" ? info.releaseNotes : null,
		}),
	);
	autoUpdater.on("update-not-available", (info) =>
		send({ state: "upToDate", version: info.version }),
	);
	autoUpdater.on("download-progress", (progress) =>
		send({
			state: "downloading",
			percent: Math.round(progress.percent),
			bytesPerSecond: progress.bytesPerSecond,
			transferred: progress.transferred,
			total: progress.total,
		}),
	);
	let downloadedVersion = null;
	autoUpdater.on("update-downloaded", (info) => {
		downloadedVersion = info.version;
		send({ state: "downloaded", version: info.version });
	});
	autoUpdater.on("error", (err) => {
		log(`[updater] error: ${err?.stack || err}`);
		// Complementary, never fatal: the editor keeps running either way.
		send({ state: "error", message: err?.message ?? String(err) });
	});

	function safeCheck() {
		autoUpdater
			.checkForUpdates()
			.catch((err) => log(`[updater] check failed: ${err?.message || err}`));
	}

	const startupTimer = setTimeout(safeCheck, CHECK_DELAY_AFTER_START_MS);
	const intervalTimer = setInterval(safeCheck, RECHECK_INTERVAL_MS);

	function flushRendererBeforeQuit() {
		return new Promise((resolve) => {
			if (!mainWindow || mainWindow.isDestroyed()) {
				resolve();
				return;
			}
			const timeout = setTimeout(() => {
				ipcMain.removeAllListeners("app:flush-before-update:done");
				resolve();
			}, FLUSH_TIMEOUT_MS);
			ipcMain.once("app:flush-before-update:done", () => {
				clearTimeout(timeout);
				resolve();
			});
			mainWindow.webContents.send("app:flush-before-update");
		});
	}

	ipcMain.handle("updater:check", async () => {
		try {
			await autoUpdater.checkForUpdates();
			return { ok: true };
		} catch (err) {
			return { ok: false, message: err?.message ?? String(err) };
		}
	});

	ipcMain.handle("updater:download", async () => {
		try {
			await autoUpdater.downloadUpdate();
			return { ok: true };
		} catch (err) {
			return { ok: false, message: err?.message ?? String(err) };
		}
	});

	ipcMain.handle("updater:install", async () => {
		// Give the renderer a chance to flush the current project (autosave)
		// before the app quits out from under it.
		await flushRendererBeforeQuit();
		// Read by main.js on the next launch so it can show "Atualizando o
		// PronixCut..." during the relaunch instead of the ordinary blank-
		// window startup gap — see getPendingUpdateMarkerPath's own comment.
		try {
			fs.writeFileSync(
				getPendingUpdateMarkerPath(),
				JSON.stringify({ version: downloadedVersion }),
			);
		} catch (err) {
			log(`[updater] failed to write pending-update marker: ${err?.message ?? err}`);
		}
		// quitAndInstall(isSilent, isForceRunAfter) — both default to `false`.
		// Leaving isSilent at its default ran the NSIS installer in full
		// interactive mode (its own wizard window, requiring the user to
		// click through Next/Install again) instead of applying the update
		// invisibly in the background. isForceRunAfter=true relaunches
		// PronixCut automatically once the silent install finishes, so the
		// user ends up back in the app with no manual steps at all.
		autoUpdater.quitAndInstall(true, true);
		return { ok: true };
	});

	return () => {
		clearTimeout(startupTimer);
		clearInterval(intervalTimer);
		ipcMain.removeHandler("updater:check");
		ipcMain.removeHandler("updater:download");
		ipcMain.removeHandler("updater:install");
	};
}

/**
 * Reads and clears the pending-update marker (if any). Called once, early
 * in main.js's startup, to decide whether this launch is "relaunching right
 * after a silent update install" vs. an ordinary cold start. Clearing it
 * immediately (rather than after the window loads) means a crash right
 * after this call still can't wedge every future launch into showing the
 * update splash forever.
 */
function consumePendingUpdateMarker() {
	const markerPath = getPendingUpdateMarkerPath();
	try {
		const raw = fs.readFileSync(markerPath, "utf8");
		fs.unlinkSync(markerPath);
		const parsed = JSON.parse(raw);
		return { version: typeof parsed.version === "string" ? parsed.version : null };
	} catch {
		return null;
	}
}

module.exports = { setupAutoUpdater, consumePendingUpdateMarker };
