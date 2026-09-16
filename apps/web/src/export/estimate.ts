export function estimateExportSizeBytes({
	durationSeconds,
	videoBitrate,
	audioBitrate,
	includeAudio,
}: {
	durationSeconds: number;
	videoBitrate: number;
	audioBitrate: number;
	includeAudio: boolean;
}): number {
	const totalBitsPerSecond = videoBitrate + (includeAudio ? audioBitrate : 0);
	return Math.max(0, Math.round((totalBitsPerSecond * durationSeconds) / 8));
}

/** `null` when the estimate can't be computed yet (e.g. no clips on the timeline). */
export function formatEstimatedSize(bytes: number | null): string {
	if (bytes === null) return "—";
	if (bytes < 1024 * 1024) return `≈ ${Math.max(1, Math.round(bytes / 1024))} KB`;
	const mb = bytes / (1024 * 1024);
	if (mb < 1024) return `≈ ${mb.toFixed(mb < 10 ? 1 : 0)} MB`;
	return `≈ ${(mb / 1024).toFixed(2)} GB`;
}
