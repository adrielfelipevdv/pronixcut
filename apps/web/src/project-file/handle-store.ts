import { IndexedDBAdapter } from "@/services/storage/indexeddb-adapter";

// `FileSystemFileHandle` is structured-cloneable, so it can be stored in
// IndexedDB directly — this is what lets Ctrl+S silently re-write the same
// on-disk .pronixcut file across a page reload without asking the user to
// pick the location again (re-using the browser's own remembered
// permission grant for that handle where possible).
const adapter = new IndexedDBAdapter<{ handle: FileSystemFileHandle }>({
	dbName: "pronixcut-project-file-handles",
	storeName: "handles",
	version: 1,
});

export async function rememberProjectFileHandle({
	projectId,
	handle,
}: {
	projectId: string;
	handle: FileSystemFileHandle;
}): Promise<void> {
	await adapter.set({ key: projectId, value: { handle } });
}

export async function getRememberedProjectFileHandle({
	projectId,
}: {
	projectId: string;
}): Promise<FileSystemFileHandle | null> {
	const record = await adapter.get(projectId);
	return record?.handle ?? null;
}

export async function forgetProjectFileHandle({
	projectId,
}: {
	projectId: string;
}): Promise<void> {
	await adapter.remove(projectId);
}

/** Verifies (and if needed, re-requests) readwrite permission for a remembered handle — browsers can silently drop permission across sessions. */
export async function ensureWritePermission({
	handle,
}: {
	handle: FileSystemFileHandle;
}): Promise<boolean> {
	const query = await handle.queryPermission?.({ mode: "readwrite" });
	if (query === "granted") return true;
	const request = await handle.requestPermission?.({ mode: "readwrite" });
	return request === "granted";
}
