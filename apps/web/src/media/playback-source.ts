import type { MediaAsset } from "@/media/types";

// Neither the live preview renderer nor the exporter ever reads an
// undecodable original's bytes directly — both build their scene graph
// from this substituted list instead. mediaId stays identical either way,
// so downstream code (video-cache, timeline) never needs to know a swap
// happened.
export function resolvePlaybackMediaAssets({
	mediaAssets,
	proxyFileByMediaId,
}: {
	mediaAssets: MediaAsset[];
	proxyFileByMediaId: (asset: MediaAsset) => File | undefined;
}): MediaAsset[] {
	return mediaAssets.map((asset) => {
		if (asset.type !== "video" || asset.canDecodeDirectly !== false) {
			return asset;
		}

		const proxyFile = proxyFileByMediaId(asset);
		if (!proxyFile) return asset;

		return { ...asset, file: proxyFile };
	});
}
