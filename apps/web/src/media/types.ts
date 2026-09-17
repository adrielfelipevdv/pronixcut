import type { MediaAssetData } from "@/services/storage/types";

export type MediaType = "image" | "video" | "audio";

export interface MediaAsset
	extends Omit<MediaAssetData, "size" | "lastModified"> {
	file: File;
	url?: string;
	// In-memory only (never persisted directly — see
	// StorageService.saveProxyFile/loadProxyFile, which keep the proxy
	// bytes in OPFS under a derived key so this survives reload).
	previewProxyFile?: File;
	previewProxyProgress?: number;
}
