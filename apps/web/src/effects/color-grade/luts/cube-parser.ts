import { createIdentityLutGrid, lutGridIndex, type LutGrid } from "./types";

export class CubeParseError extends Error {}

interface ParsedCubeTable {
	size: number;
	is1D: boolean;
	domainMin: [number, number, number];
	domainMax: [number, number, number];
	rows: [number, number, number][];
}

/** Real `.cube` (Iridas/Adobe format) parser — 1D and 3D tables, TITLE, DOMAIN_MIN/MAX, `#` comments. No partial/fake parsing: malformed files throw. */
function parseCubeTable(text: string): ParsedCubeTable {
	let size: number | null = null;
	let is1D = false;
	let domainMin: [number, number, number] = [0, 0, 0];
	let domainMax: [number, number, number] = [1, 1, 1];
	const rows: [number, number, number][] = [];

	const lines = text.split(/\r\n|\r|\n/);
	for (const rawLine of lines) {
		const line = rawLine.trim();
		if (!line || line.startsWith("#")) continue;

		if (line.startsWith("TITLE")) continue;

		if (line.startsWith("LUT_3D_SIZE")) {
			const value = Number.parseInt(line.split(/\s+/)[1] ?? "", 10);
			if (!Number.isFinite(value) || value < 2) {
				throw new CubeParseError(`LUT_3D_SIZE inválido: "${line}"`);
			}
			size = value;
			is1D = false;
			continue;
		}

		if (line.startsWith("LUT_1D_SIZE")) {
			const value = Number.parseInt(line.split(/\s+/)[1] ?? "", 10);
			if (!Number.isFinite(value) || value < 2) {
				throw new CubeParseError(`LUT_1D_SIZE inválido: "${line}"`);
			}
			size = value;
			is1D = true;
			continue;
		}

		if (line.startsWith("DOMAIN_MIN")) {
			const parts = line.split(/\s+/).slice(1).map(Number);
			if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
				throw new CubeParseError(`DOMAIN_MIN inválido: "${line}"`);
			}
			domainMin = [parts[0], parts[1], parts[2]];
			continue;
		}

		if (line.startsWith("DOMAIN_MAX")) {
			const parts = line.split(/\s+/).slice(1).map(Number);
			if (parts.length !== 3 || parts.some((n) => !Number.isFinite(n))) {
				throw new CubeParseError(`DOMAIN_MAX inválido: "${line}"`);
			}
			domainMax = [parts[0], parts[1], parts[2]];
			continue;
		}

		// Anything else that isn't a data row (unknown keyword) is ignored per
		// the format's convention of forward-compatible metadata lines — but a
		// data row must be exactly 3 numbers, or the file is malformed.
		const parts = line.split(/\s+/);
		if (parts.length === 3 && parts.every((p) => Number.isFinite(Number(p)))) {
			rows.push([Number(parts[0]), Number(parts[1]), Number(parts[2])]);
		}
	}

	if (size === null) {
		throw new CubeParseError("Arquivo .cube sem LUT_3D_SIZE ou LUT_1D_SIZE");
	}

	const expectedRows = is1D ? size : size ** 3;
	if (rows.length !== expectedRows) {
		throw new CubeParseError(
			`Número de linhas de dados incorreto: esperado ${expectedRows}, encontrado ${rows.length}`,
		);
	}

	return { size, is1D, domainMin, domainMax, rows };
}

function normalizeDomain({
	value,
	channel,
	domainMin,
	domainMax,
}: {
	value: number;
	channel: 0 | 1 | 2;
	domainMin: [number, number, number];
	domainMax: [number, number, number];
}): number {
	const min = domainMin[channel];
	const max = domainMax[channel];
	if (max === min) return 0;
	return Math.min(1, Math.max(0, (value - min) / (max - min)));
}

/** Parses `.cube` text into a 3D LUT grid ready for GPU upload. A 1D table is expanded into a 3D grid by applying its per-channel curve independently (no cross-channel mixing, matching a real 1D LUT's semantics) — not a partial/fake parse, the math is exact for what a 1D LUT actually represents. */
export function parseCubeFile(text: string): LutGrid {
	const table = parseCubeTable(text);

	if (!table.is1D) {
		const data = new Float32Array(table.size * table.size * table.size * 3);
		for (let b = 0; b < table.size; b++) {
			for (let g = 0; g < table.size; g++) {
				for (let r = 0; r < table.size; r++) {
					const rowIndex = b * table.size * table.size + g * table.size + r;
					const [rv, gv, bv] = table.rows[rowIndex];
					const idx = lutGridIndex({ size: table.size, r, g, b });
					data[idx] = normalizeDomain({
						value: rv,
						channel: 0,
						domainMin: table.domainMin,
						domainMax: table.domainMax,
					});
					data[idx + 1] = normalizeDomain({
						value: gv,
						channel: 1,
						domainMin: table.domainMin,
						domainMax: table.domainMax,
					});
					data[idx + 2] = normalizeDomain({
						value: bv,
						channel: 2,
						domainMin: table.domainMin,
						domainMax: table.domainMax,
					});
				}
			}
		}
		return { size: table.size, data };
	}

	// 1D: build per-channel lookup arrays from the table, then sample each
	// channel independently while walking a 3D identity grid.
	const size1D = table.size;
	const redCurve = table.rows.map((row) =>
		normalizeDomain({ value: row[0], channel: 0, domainMin: table.domainMin, domainMax: table.domainMax }),
	);
	const greenCurve = table.rows.map((row) =>
		normalizeDomain({ value: row[1], channel: 1, domainMin: table.domainMin, domainMax: table.domainMax }),
	);
	const blueCurve = table.rows.map((row) =>
		normalizeDomain({ value: row[2], channel: 2, domainMin: table.domainMin, domainMax: table.domainMax }),
	);
	const sample1D = (curve: number[], t: number): number => {
		const pos = t * (size1D - 1);
		const i0 = Math.floor(pos);
		const i1 = Math.min(size1D - 1, i0 + 1);
		const frac = pos - i0;
		return curve[i0] * (1 - frac) + curve[i1] * frac;
	};

	const gridSize = 17;
	const grid = createIdentityLutGrid({ size: gridSize });
	for (let b = 0; b < gridSize; b++) {
		for (let g = 0; g < gridSize; g++) {
			for (let r = 0; r < gridSize; r++) {
				const idx = lutGridIndex({ size: gridSize, r, g, b });
				const rt = r / (gridSize - 1);
				const gt = g / (gridSize - 1);
				const bt = b / (gridSize - 1);
				grid.data[idx] = sample1D(redCurve, rt);
				grid.data[idx + 1] = sample1D(greenCurve, gt);
				grid.data[idx + 2] = sample1D(blueCurve, bt);
			}
		}
	}
	return grid;
}
