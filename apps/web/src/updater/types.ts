export type UpdaterStatus =
	| { state: "idle" }
	| { state: "checking" }
	| { state: "updateAvailable"; version: string; releaseNotes: string | null }
	| {
			state: "downloading";
			percent: number;
			bytesPerSecond: number;
			transferred: number;
			total: number;
	  }
	| { state: "downloaded"; version: string }
	| { state: "upToDate"; version: string }
	| { state: "error"; message: string };

export interface PronixAppBridge {
	isElectron: true;
	getVersion: () => Promise<string>;
}

export interface PronixUpdaterBridge {
	check: () => Promise<{ ok: boolean; message?: string }>;
	download: () => Promise<{ ok: boolean; message?: string }>;
	quitAndInstall: () => Promise<{ ok: boolean; message?: string }>;
	onStatus: (callback: (status: UpdaterStatus) => void) => () => void;
}

export interface PronixLifecycleBridge {
	onFlushBeforeUpdate: (handler: () => Promise<void> | void) => () => void;
}

declare global {
	interface Window {
		pronixApp?: PronixAppBridge;
		pronixUpdater?: PronixUpdaterBridge;
		pronixLifecycle?: PronixLifecycleBridge;
	}
}

export function isRunningInElectron(): boolean {
	return typeof window !== "undefined" && window.pronixApp?.isElectron === true;
}
