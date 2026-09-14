const { contextBridge, ipcRenderer } = require("electron");

// Narrow, explicit bridge — the renderer only ever gets these specific
// request/response channels, never raw ipcRenderer/ipcMain access. Nothing
// here can read/write the filesystem or spawn processes directly; every
// call is a round trip through main.js, which decides what's allowed.
contextBridge.exposeInMainWorld("pronixApp", {
	isElectron: true,
	getVersion: () => ipcRenderer.invoke("app:get-version"),
});

contextBridge.exposeInMainWorld("pronixUpdater", {
	check: () => ipcRenderer.invoke("updater:check"),
	download: () => ipcRenderer.invoke("updater:download"),
	quitAndInstall: () => ipcRenderer.invoke("updater:install"),
	onStatus: (callback) => {
		const listener = (_event, status) => callback(status);
		ipcRenderer.on("updater:status", listener);
		return () => ipcRenderer.removeListener("updater:status", listener);
	},
});

// main.js asks the renderer to flush any in-progress project save before it
// quits to install an update. The renderer does the actual save (it owns
// the editor/project state) and acks back over "app:flush-before-update:done"
// when done, so main.js knows it's safe to proceed.
contextBridge.exposeInMainWorld("pronixLifecycle", {
	onFlushBeforeUpdate: (handler) => {
		const listener = async () => {
			try {
				await handler();
			} finally {
				ipcRenderer.send("app:flush-before-update:done");
			}
		};
		ipcRenderer.on("app:flush-before-update", listener);
		return () => ipcRenderer.removeListener("app:flush-before-update", listener);
	},
});
