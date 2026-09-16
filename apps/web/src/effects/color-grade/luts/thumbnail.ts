import type { LutGrid } from "./types";

const THUMBNAIL_SIZE = 96;
const REFERENCE_IMAGE_SRC = "/effects/preview.jpg";

let referenceImagePromise: Promise<HTMLImageElement> | null = null;

function loadReferenceImage(): Promise<HTMLImageElement> {
	if (!referenceImagePromise) {
		referenceImagePromise = new Promise((resolve, reject) => {
			const image = new Image();
			image.crossOrigin = "anonymous";
			image.onload = () => resolve(image);
			image.onerror = () => reject(new Error("Failed to load LUT preview reference image"));
			image.src = REFERENCE_IMAGE_SRC;
		});
	}
	return referenceImagePromise;
}

function sampleLutTrilinear({
	grid,
	r,
	g,
	b,
}: {
	grid: LutGrid;
	r: number;
	g: number;
	b: number;
}): [number, number, number] {
	const { size, data } = grid;
	const fr = r * (size - 1);
	const fg = g * (size - 1);
	const fb = b * (size - 1);
	const r0 = Math.floor(fr);
	const g0 = Math.floor(fg);
	const b0 = Math.floor(fb);
	const r1 = Math.min(size - 1, r0 + 1);
	const g1 = Math.min(size - 1, g0 + 1);
	const b1 = Math.min(size - 1, b0 + 1);
	const tr = fr - r0;
	const tg = fg - g0;
	const tb = fb - b0;

	const at = (ri: number, gi: number, bi: number, channel: number) =>
		data[(bi * size * size + gi * size + ri) * 3 + channel];

	const lerp = (a: number, bValue: number, t: number) => a + (bValue - a) * t;

	const out: [number, number, number] = [0, 0, 0];
	for (let channel = 0; channel < 3; channel++) {
		const c000 = at(r0, g0, b0, channel);
		const c100 = at(r1, g0, b0, channel);
		const c010 = at(r0, g1, b0, channel);
		const c110 = at(r1, g1, b0, channel);
		const c001 = at(r0, g0, b1, channel);
		const c101 = at(r1, g0, b1, channel);
		const c011 = at(r0, g1, b1, channel);
		const c111 = at(r1, g1, b1, channel);

		const c00 = lerp(c000, c100, tr);
		const c10 = lerp(c010, c110, tr);
		const c01 = lerp(c001, c101, tr);
		const c11 = lerp(c011, c111, tr);
		const c0 = lerp(c00, c10, tg);
		const c1 = lerp(c01, c11, tg);
		out[channel] = lerp(c0, c1, tb);
	}
	return out;
}

const thumbnailCache = new Map<string, string>();

/**
 * Renders the shared reference photo through a LUT grid into a small cached
 * thumbnail — a one-time, tiny (96x96) computation done once per LUT and
 * cached as a data URL, not part of the per-frame render path.
 */
export async function renderLutThumbnail({ grid, cacheKey }: { grid: LutGrid; cacheKey: string }): Promise<string> {
	const cached = thumbnailCache.get(cacheKey);
	if (cached) return cached;

	const image = await loadReferenceImage();
	const canvas = document.createElement("canvas");
	canvas.width = THUMBNAIL_SIZE;
	canvas.height = THUMBNAIL_SIZE;
	const ctx = canvas.getContext("2d");
	if (!ctx) throw new Error("Could not get 2D context for LUT thumbnail");

	ctx.drawImage(image, 0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
	const imageData = ctx.getImageData(0, 0, THUMBNAIL_SIZE, THUMBNAIL_SIZE);
	const { data } = imageData;
	for (let i = 0; i < data.length; i += 4) {
		const [r, g, b] = sampleLutTrilinear({
			grid,
			r: data[i] / 255,
			g: data[i + 1] / 255,
			b: data[i + 2] / 255,
		});
		data[i] = Math.round(Math.min(1, Math.max(0, r)) * 255);
		data[i + 1] = Math.round(Math.min(1, Math.max(0, g)) * 255);
		data[i + 2] = Math.round(Math.min(1, Math.max(0, b)) * 255);
	}
	ctx.putImageData(imageData, 0, 0);

	const url = canvas.toDataURL("image/jpeg", 0.85);
	thumbnailCache.set(cacheKey, url);
	return url;
}

export function getReferenceImageSrc(): string {
	return REFERENCE_IMAGE_SRC;
}
