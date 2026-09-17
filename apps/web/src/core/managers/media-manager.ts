import type { EditorCore } from "@/core";
import { toast } from "sonner";
import type { MediaAsset } from "@/media/types";
import { storageService } from "@/services/storage/service";
import { generateUUID } from "@/utils/id";
import { videoCache } from "@/services/video-cache/service";
import { waveformCache } from "@/services/waveform-cache/service";
import { generateProxyFile } from "@/media/proxy-client";
import { BatchCommand, RemoveMediaAssetCommand } from "@/commands";

export class MediaManager {
	private assets: MediaAsset[] = [];
	private isLoading = false;
	private listeners = new Set<() => void>();
	// Export proxies aren't persisted (see proxy-client.ts) — they're
	// regenerated lazily per export run and kept here only for the
	// duration of that run's frame loop.
	private exportProxyFiles = new Map<string, File>();

	constructor(private editor: EditorCore) {}

	private async startPreviewProxyGeneration({
		projectId,
		asset,
	}: {
		projectId: string;
		asset: MediaAsset;
	}): Promise<void> {
		this.updateAsset({
			id: asset.id,
			patch: { previewProxyStatus: "generating", previewProxyProgress: 0 },
		});

		try {
			const proxyFile = await generateProxyFile({
				sourceFile: asset.file,
				purpose: "preview",
				proxyFileName: `${asset.id}-preview-proxy.mp4`,
				onProgress: (progress) => {
					this.updateAsset({
						id: asset.id,
						patch: { previewProxyProgress: progress },
					});
				},
			});

			await storageService.saveProxyFile({
				projectId,
				mediaId: asset.id,
				file: proxyFile,
			});

			videoCache.clearVideo({ mediaId: asset.id });
			this.updateAsset({
				id: asset.id,
				patch: {
					previewProxyStatus: "ready",
					previewProxyProgress: 100,
					previewProxyFile: proxyFile,
					previewProxyError: null,
				},
			});
			await this.persistProxyMetadata({ projectId, id: asset.id });
		} catch (error) {
			const message =
				error instanceof Error ? error.message : "Não foi possível preparar este vídeo para edição.";

			this.updateAsset({
				id: asset.id,
				patch: { previewProxyStatus: "error", previewProxyError: message },
			});
			await this.persistProxyMetadata({ projectId, id: asset.id });

			const details = [
				asset.codec?.toUpperCase(),
				asset.width && asset.height ? `${asset.width}x${asset.height}` : null,
			]
				.filter(Boolean)
				.join(", ");

			toast.error("Não foi possível preparar este vídeo para edição.", {
				description: `${asset.name}${details ? ` (${details})` : ""} — ${message}`,
				action: {
					label: "Tentar novamente",
					onClick: () => {
						void this.retryPreviewProxy({ projectId, id: asset.id });
					},
				},
			});
		}
	}

	async retryPreviewProxy({
		projectId,
		id,
	}: {
		projectId: string;
		id: string;
	}): Promise<void> {
		const asset = this.assets.find((a) => a.id === id);
		if (!asset) return;
		await this.startPreviewProxyGeneration({ projectId, asset });
	}

	private async persistProxyMetadata({
		projectId,
		id,
	}: {
		projectId: string;
		id: string;
	}): Promise<void> {
		const asset = this.assets.find((a) => a.id === id);
		if (!asset) return;
		await storageService.updateMediaAssetMetadata({ projectId, mediaAsset: asset }).catch((error) => {
			console.error("Failed to persist proxy metadata:", error);
		});
	}

	private updateAsset({
		id,
		patch,
	}: {
		id: string;
		patch: Partial<MediaAsset>;
	}): void {
		this.assets = this.assets.map((asset) =>
			asset.id === id ? { ...asset, ...patch } : asset,
		);
		this.notify();
	}

	async getOrCreateExportProxy({
		asset,
	}: {
		asset: MediaAsset;
	}): Promise<File> {
		const cached = this.exportProxyFiles.get(asset.id);
		if (cached) return cached;

		const proxyFile = await generateProxyFile({
			sourceFile: asset.file,
			purpose: "export",
			proxyFileName: `${asset.id}-export-proxy.mp4`,
		});

		this.exportProxyFiles.set(asset.id, proxyFile);
		return proxyFile;
	}

	clearExportProxies(): void {
		this.exportProxyFiles.clear();
	}

	async addMediaAsset({
		projectId,
		asset,
	}: {
		projectId: string;
		asset: Omit<MediaAsset, "id">;
	}): Promise<MediaAsset | null> {
		const newAsset: MediaAsset = {
			...asset,
			id: generateUUID(),
		};

		this.assets = [...this.assets, newAsset];
		this.notify();

		try {
			await storageService.saveMediaAsset({ projectId, mediaAsset: newAsset });
			this.editor.project.ratchetFpsForImportedMedia({
				importedAssets: [newAsset],
			});

			if (newAsset.previewProxyStatus === "pending") {
				void this.startPreviewProxyGeneration({ projectId, asset: newAsset });
			}

			return newAsset;
		} catch (error) {
			console.error("Failed to save media asset:", error);
			this.assets = this.assets.filter((asset) => asset.id !== newAsset.id);
			this.notify();

			if (storageService.isQuotaExceededError({ error })) {
				toast.error("Espaço de armazenamento insuficiente", {
					description: error instanceof Error ? error.message : undefined,
				});
			}

			return null;
		}
	}

	removeMediaAsset({ projectId, id }: { projectId: string; id: string }): void {
		this.removeMediaAssets({ projectId, ids: [id] });
	}

	removeMediaAssets({
		projectId,
		ids,
	}: {
		projectId: string;
		ids: string[];
	}): void {
		const uniqueIds = [...new Set(ids)];
		if (uniqueIds.length === 0) {
			return;
		}

		const command =
			uniqueIds.length === 1
				? new RemoveMediaAssetCommand({
						projectId,
						assetId: uniqueIds[0],
					})
				: new BatchCommand(
						uniqueIds.map((id) =>
							new RemoveMediaAssetCommand({
								projectId,
								assetId: id,
							}),
						),
					);

		this.editor.command.execute({ command });
	}

	async loadProjectMedia({ projectId }: { projectId: string }): Promise<void> {
		this.isLoading = true;
		this.notify();

		try {
			const mediaAssets = await storageService.loadAllMediaAssets({
				projectId,
			});
			this.assets = mediaAssets;
			this.notify();
		} catch (error) {
			console.error("Failed to load media assets:", error);
		} finally {
			this.isLoading = false;
			this.notify();
		}
	}

	async clearProjectMedia({ projectId }: { projectId: string }): Promise<void> {
		waveformCache.clearAll();

		this.assets.forEach((asset) => {
			if (asset.url) {
				URL.revokeObjectURL(asset.url);
			}
			if (asset.thumbnailUrl) {
				URL.revokeObjectURL(asset.thumbnailUrl);
			}
		});

		const mediaIds = this.assets.map((asset) => asset.id);
		this.assets = [];
		this.notify();

		try {
			await Promise.all(
				mediaIds.map((id) =>
					storageService.deleteMediaAsset({ projectId, id }),
				),
			);
		} catch (error) {
			console.error("Failed to clear media assets from storage:", error);
		}
	}

	clearAllAssets(): void {
		videoCache.clearAll();
		waveformCache.clearAll();
		this.exportProxyFiles.clear();

		this.assets.forEach((asset) => {
			if (asset.url) {
				URL.revokeObjectURL(asset.url);
			}
			if (asset.thumbnailUrl) {
				URL.revokeObjectURL(asset.thumbnailUrl);
			}
		});

		this.assets = [];
		this.notify();
	}

	getAssets(): MediaAsset[] {
		return this.assets;
	}

	setAssets({ assets }: { assets: MediaAsset[] }): void {
		this.assets = assets;
		this.notify();
	}

	isLoadingMedia(): boolean {
		return this.isLoading;
	}

	subscribe(listener: () => void): () => void {
		this.listeners.add(listener);
		return () => this.listeners.delete(listener);
	}

	private notify(): void {
		this.listeners.forEach((fn) => {
			fn();
		});
	}
}
