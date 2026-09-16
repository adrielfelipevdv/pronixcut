import { createIdentityLutGrid, lutGridIndex, type LutGrid } from "./types";

// Original, procedurally-generated "looks" — each is our own small RGB
// transform function sampled across a grid, not extracted or copied from any
// third-party product's LUT files. Kept as pure math (not per-frame JS: the
// grid is built once and cached, then only ever sampled on the GPU).

export interface GeneratedLutSpec {
	id: string;
	name: string;
	transform: (rgb: [number, number, number]) => [number, number, number];
}

function clamp01(v: number): number {
	return Math.min(1, Math.max(0, v));
}

function luminance([r, g, b]: [number, number, number]): number {
	return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

/** Smooth S-curve around the midpoint — `amount` 0 = identity, 1 = strong contrast. */
function sCurve(x: number, amount: number): number {
	const k = amount * 4;
	const centered = x - 0.5;
	const eased = centered + k * centered * (0.25 - centered * centered);
	return clamp01(eased + 0.5);
}

function tint(
	[r, g, b]: [number, number, number],
	[tr, tg, tb]: [number, number, number],
	amount: number,
): [number, number, number] {
	return [
		clamp01(r + (tr - 0.5) * amount),
		clamp01(g + (tg - 0.5) * amount),
		clamp01(b + (tb - 0.5) * amount),
	];
}

function desaturate([r, g, b]: [number, number, number], amount: number): [number, number, number] {
	const l = luminance([r, g, b]);
	return [
		clamp01(r + (l - r) * amount),
		clamp01(g + (l - g) * amount),
		clamp01(b + (l - b) * amount),
	];
}

export const GENERATED_LUT_SPECS: GeneratedLutSpec[] = [
	{
		id: "pronix-cinema",
		name: "Cinema",
		transform: ([r, g, b]) => {
			const contrasted: [number, number, number] = [sCurve(r, 0.35), sCurve(g, 0.35), sCurve(b, 0.35)];
			const l = luminance(contrasted);
			// Shadows lean teal, highlights lean warm — split-toning by luminance.
			const shadowPull = (1 - l) * 0.12;
			const highlightPull = l * 0.1;
			return [
				clamp01(contrasted[0] + highlightPull - shadowPull * 0.3),
				clamp01(contrasted[1] + shadowPull * 0.15),
				clamp01(contrasted[2] + shadowPull - highlightPull * 0.3),
			];
		},
	},
	{
		id: "pronix-warm",
		name: "Quente",
		transform: ([r, g, b]) => {
			const warm = tint([r, g, b], [0.62, 0.53, 0.38], 0.28);
			return desaturate(warm, -0.08).map(clamp01) as [number, number, number];
		},
	},
	{
		id: "pronix-cold",
		name: "Frio",
		transform: ([r, g, b]) => tint([r, g, b], [0.38, 0.5, 0.66], 0.26),
	},
	{
		id: "pronix-contrast",
		name: "Contraste",
		transform: ([r, g, b]) => [sCurve(r, 0.6), sCurve(g, 0.6), sCurve(b, 0.6)],
	},
	{
		id: "pronix-vintage",
		name: "Vintage",
		transform: ([r, g, b]) => {
			const faded: [number, number, number] = [
				clamp01(r * 0.9 + 0.06),
				clamp01(g * 0.9 + 0.055),
				clamp01(b * 0.88 + 0.05),
			];
			const warmed = tint(faded, [0.58, 0.52, 0.42], 0.14);
			return desaturate(warmed, 0.18);
		},
	},
	{
		id: "pronix-soft",
		name: "Soft",
		transform: ([r, g, b]) => {
			const lowered: [number, number, number] = [sCurve(r, -0.25), sCurve(g, -0.25), sCurve(b, -0.25)];
			return desaturate(lowered, 0.1);
		},
	},
	{
		id: "pronix-teal-orange",
		name: "Teal & Orange suave",
		transform: ([r, g, b]) => {
			const l = luminance([r, g, b]);
			const shadowWeight = clamp01(1 - l * 1.4);
			const highlightWeight = clamp01((l - 0.35) * 1.4);
			return [
				clamp01(r + highlightWeight * 0.1 - shadowWeight * 0.04),
				clamp01(g + highlightWeight * 0.03 + shadowWeight * 0.02),
				clamp01(b - highlightWeight * 0.06 + shadowWeight * 0.08),
			];
		},
	},
];

const GENERATED_LUT_GRID_SIZE = 17;
const gridCache = new Map<string, LutGrid>();

export function getGeneratedLutGrid({ id }: { id: string }): LutGrid | null {
	const cached = gridCache.get(id);
	if (cached) return cached;

	const spec = GENERATED_LUT_SPECS.find((s) => s.id === id);
	if (!spec) return null;

	const size = GENERATED_LUT_GRID_SIZE;
	const grid = createIdentityLutGrid({ size });
	for (let b = 0; b < size; b++) {
		for (let g = 0; g < size; g++) {
			for (let r = 0; r < size; r++) {
				const idx = lutGridIndex({ size, r, g, b });
				const [tr, tg, tb] = spec.transform([r / (size - 1), g / (size - 1), b / (size - 1)]);
				grid.data[idx] = tr;
				grid.data[idx + 1] = tg;
				grid.data[idx + 2] = tb;
			}
		}
	}
	gridCache.set(id, grid);
	return grid;
}
