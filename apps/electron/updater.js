const { app, ipcMain } = require("electron");
const { autoUpdater } = require("electron-updater");

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
	autoUpdater.on("update-downloaded", (info) =>
		send({ state: "downloaded", version: info.version }),
	);
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
		autoUpdater.quitAndInstall();
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

module.exports = { setupAutoUpdater };
