/**
 * A 3D color lookup table grid: `size` x `size` x `size` RGB triplets in
 * [0,1], flattened with R fastest-varying, then G, then B —
 * `data[(b*size*size + g*size + r) * 3 + channel]` — which is both the
 * standard `.cube` row order and the layout `texImage3D` expects when the
 * grid's R/G/B axes are mapped to the texture's width/height/depth axes
 * (see webgl/grade-pass.ts).
 */
export interface LutGrid {
	size: number;
	data: Float32Array;
}

export function lutGridIndex({
	size,
	r,
	g,
	b,
}: {
	size: number;
	r: number;
	g: number;
	b: number;
}): number {
	return (b * size * size + g * size + r) * 3;
}

export function createIdentityLutGrid({ size = 2 }: { size?: number } = {}): LutGrid {
	const data = new Float32Array(size * size * size * 3);
	for (let b = 0; b < size; b++) {
		for (let g = 0; g < size; g++) {
			for (let r = 0; r < size; r++) {
				const idx = lutGridIndex({ size, r, g, b });
				data[idx] = size === 1 ? 0 : r / (size - 1);
				data[idx + 1] = size === 1 ? 0 : g / (size - 1);
				data[idx + 2] = size === 1 ? 0 : b / (size - 1);
			}
		}
	}
	return { size, data };
}

export interface LutMeta {
	id: string;
	name: string;
	kind: "builtin" | "imported";
	createdAt: string;
}
