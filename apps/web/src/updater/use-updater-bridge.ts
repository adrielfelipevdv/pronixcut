"use client";

import { useEffect } from "react";
import { EditorCore } from "@/core";
import { useUpdaterStore } from "./updater-store";
import { isRunningInElectron } from "./types";

/**
 * Mounted once near the app root. Wires the Electron preload bridge to the
 * updater store, and answers main.js's "flush before installing an update"
 * request by running the same autosave the editor already uses — never a
 * bespoke save path. A no-op outside Electron (dev/browser), so this is
 * always safe to mount.
 */
export function useUpdaterBridge() {
	useEffect(() => {
		if (!isRunningInElectron()) return;

		const unsubscribeStatus = window.pronixUpdater?.onStatus((status) => {
			useUpdaterStore.getState().setStatus(status);
		});

		window.pronixApp
			?.getVersion()
			.then((version) => useUpdaterStore.getState().setCurrentVersion(version))
			.catch(() => {});

		const unsubscribeFlush = window.pronixLifecycle?.onFlushBeforeUpdate(
			async () => {
				try {
					const editor = EditorCore.getInstance();
					await editor.save.flush();
				} catch (error) {
					console.error("Failed to flush project before update:", error);
				}
			},
		);

		return () => {
			unsubscribeStatus?.();
			unsubscribeFlush?.();
		};
	}, []);
}
