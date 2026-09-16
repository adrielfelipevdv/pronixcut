export interface Size {
	width: number;
	height: number;
}

export const RESOLUTION_PRESET_VALUES = [
	"project",
	"720p",
	"1080p",
	"1440p",
	"2160p",
	"custom",
] as const;

export type ResolutionPreset = (typeof RESOLUTION_PRESET_VALUES)[number];

export const RESOLUTION_PRESET_LABELS: Record<ResolutionPreset, string> = {
	project: "Igual ao projeto",
	"720p": "720p",
	"1080p": "1080p",
	"1440p": "1440p / 2K",
	"2160p": "2160p / 4K",
	custom: "Personalizada",
};

// The nominal pixel count each preset targets on the frame's SHORTER side —
// the longer side is then derived from the project's own aspect ratio, so
// "1080p" means 1920x1080 for a 16:9 project but 1080x1920 for a 9:16 one,
// and 1080x1080 for a 1:1 project. Never assume landscape.
const RESOLUTION_PRESET_SHORT_SIDE: Partial<Record<ResolutionPreset, number>> = {
	"720p": 720,
	"1080p": 1080,
	"1440p": 1440,
	"2160p": 2160,
};

/** Rounds to the nearest even number — most video codecs require even width/height for 4:2:0 chroma subsampling. */
function toEven(value: number): number {
	return Math.max(2, Math.round(value / 2) * 2);
}

/**
 * Computes the actual output width/height for a resolution preset, given
 * the project's own canvas size — respecting its orientation and exact
 * aspect ratio rather than assuming 16:9.
 */
export function computeResolutionForPreset({
	preset,
	projectSize,
	custom,
}: {
	preset: ResolutionPreset;
	projectSize: Size;
	/** Required when `preset === "custom"`. */
	custom?: Size;
}): Size {
	if (preset === "project") {
		return { width: projectSize.width, height: projectSize.height };
	}
	if (preset === "custom") {
		if (!custom) {
			throw new Error("computeResolutionForPreset: custom size required for 'custom' preset");
		}
		return { width: toEven(custom.width), height: toEven(custom.height) };
	}

	const shortSide = RESOLUTION_PRESET_SHORT_SIDE[preset];
	if (!shortSide) {
		throw new Error(`computeResolutionForPreset: unknown preset "${preset}"`);
	}

	const { width, height } = projectSize;
	if (width === height) {
		return { width: shortSide, height: shortSide };
	}

	if (width > height) {
		// Landscape: the shorter side is the height.
		const outHeight = shortSide;
		const outWidth = toEven((shortSide * width) / height);
		return { width: outWidth, height: toEven(outHeight) };
	}

	// Portrait: the shorter side is the width.
	const outWidth = shortSide;
	const outHeight = toEven((shortSide * height) / width);
	return { width: toEven(outWidth), height: outHeight };
}

export function formatAspectRatio({ width, height }: Size): string {
	const divisor = gcd(width, height);
	return `${width / divisor}:${height / divisor}`;
}

function gcd(a: number, b: number): number {
	let x = Math.abs(a);
	let y = Math.abs(b);
	while (y !== 0) {
		[x, y] = [y, x % y];
	}
	return x || 1;
}
