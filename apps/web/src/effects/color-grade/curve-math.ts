export interface CurvePoint {
	x: number; // 0..1
	y: number; // 0..1
}

export const CURVE_LUT_SIZE = 256;

export const DEFAULT_CURVE_POINTS: CurvePoint[] = [
	{ x: 0, y: 0 },
	{ x: 1, y: 1 },
];

function clamp01(value: number): number {
	return Math.min(1, Math.max(0, value));
}

/** Catmull-Rom spline through sorted points, clamped to endpoints past the range. */
function catmullRomAt({
	points,
	x,
}: {
	points: CurvePoint[];
	x: number;
}): number {
	const n = points.length;
	if (n === 0) return x;
	if (n === 1) return points[0].y;
	if (x <= points[0].x) return points[0].y;
	if (x >= points[n - 1].x) return points[n - 1].y;

	let i = 0;
	while (i < n - 2 && x > points[i + 1].x) i++;

	const p0 = points[Math.max(0, i - 1)];
	const p1 = points[i];
	const p2 = points[Math.min(n - 1, i + 1)];
	const p3 = points[Math.min(n - 1, i + 2)];

	const span = p2.x - p1.x;
	if (span <= 0) return p1.y;
	const t = (x - p1.x) / span;
	const t2 = t * t;
	const t3 = t2 * t;

	// Catmull-Rom basis (tension 0.5), evaluated on the Y values only — X
	// spacing is irregular so this approximates a uniform parametrization,
	// which is fine for a tone curve (monotonic-ish, small point count).
	const y =
		0.5 *
		(2 * p1.y +
			(-p0.y + p2.y) * t +
			(2 * p0.y - 5 * p1.y + 4 * p2.y - p3.y) * t2 +
			(-p0.y + 3 * p1.y - 3 * p2.y + p3.y) * t3);

	return y;
}

/** Samples a curve (2+ points, sorted by x) into a fixed-size lookup table of 0..1 Y values. */
export function sampleCurveToLut({
	points,
	size = CURVE_LUT_SIZE,
}: {
	points: CurvePoint[];
	size?: number;
}): Float32Array {
	const sorted = [...points].sort((a, b) => a.x - b.x);
	const lut = new Float32Array(size);
	for (let i = 0; i < size; i++) {
		const x = i / (size - 1);
		lut[i] = clamp01(catmullRomAt({ points: sorted, x }));
	}
	return lut;
}

export function isIdentityCurve(points: CurvePoint[]): boolean {
	if (points.length !== 2) return false;
	const sorted = [...points].sort((a, b) => a.x - b.x);
	return (
		Math.abs(sorted[0].x - 0) < 1e-6 &&
		Math.abs(sorted[0].y - 0) < 1e-6 &&
		Math.abs(sorted[1].x - 1) < 1e-6 &&
		Math.abs(sorted[1].y - 1) < 1e-6
	);
}

/** Composes an "rgb" (master) curve with a per-channel curve into one 0..255 lookup table: out = channelCurve(rgbCurve(in)). */
export function composeChannelLut({
	rgbPoints,
	channelPoints,
}: {
	rgbPoints: CurvePoint[];
	channelPoints: CurvePoint[];
}): Uint8Array {
	const rgbLut = sampleCurveToLut({ points: rgbPoints });
	const channelLut = sampleCurveToLut({ points: channelPoints });
	const out = new Uint8Array(CURVE_LUT_SIZE);
	for (let i = 0; i < CURVE_LUT_SIZE; i++) {
		const afterRgb = rgbLut[i];
		const index = Math.round(clamp01(afterRgb) * (CURVE_LUT_SIZE - 1));
		const afterChannel = channelLut[index];
		out[i] = Math.round(clamp01(afterChannel) * 255);
	}
	return out;
}

export function addCurvePoint({
	points,
	point,
}: {
	points: CurvePoint[];
	point: CurvePoint;
}): CurvePoint[] {
	return [...points, point].sort((a, b) => a.x - b.x);
}

export function removeCurvePoint({
	points,
	index,
}: {
	points: CurvePoint[];
	index: number;
}): CurvePoint[] {
	// Keep at least the two endpoint anchors so the curve never collapses to
	// a single point (which would make sampleCurveToLut degenerate).
	if (points.length <= 2) return points;
	return points.filter((_, i) => i !== index);
}

export function moveCurvePoint({
	points,
	index,
	point,
	isEndpoint,
}: {
	points: CurvePoint[];
	index: number;
	point: CurvePoint;
	isEndpoint: boolean;
}): CurvePoint[] {
	const next = points.map((p, i) =>
		i === index
			? {
					// Endpoints (first/last) stay pinned to x=0 / x=1 — only their Y moves.
					x: isEndpoint ? p.x : clamp01(point.x),
					y: clamp01(point.y),
				}
			: p,
	);
	return next.sort((a, b) => a.x - b.x);
}
