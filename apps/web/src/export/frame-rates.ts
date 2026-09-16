import type { FrameRate } from "opencut-wasm";

export interface ExportFrameRateOption {
	id: string;
	label: string;
	rate: FrameRate;
}

// The exact fractional rates broadcast/NLE tools use — 23.976/29.97/59.94
// are NTSC-derived (30000/1001 etc.), not plain decimals, so they're kept as
// exact numerator/denominator pairs all the way to the encoder.
export const EXPORT_FRAME_RATE_OPTIONS: ExportFrameRateOption[] = [
	{ id: "23.976", label: "23.976 fps", rate: { numerator: 24_000, denominator: 1_001 } },
	{ id: "24", label: "24 fps", rate: { numerator: 24, denominator: 1 } },
	{ id: "25", label: "25 fps", rate: { numerator: 25, denominator: 1 } },
	{ id: "29.97", label: "29.97 fps", rate: { numerator: 30_000, denominator: 1_001 } },
	{ id: "30", label: "30 fps", rate: { numerator: 30, denominator: 1 } },
	{ id: "50", label: "50 fps", rate: { numerator: 50, denominator: 1 } },
	{ id: "59.94", label: "59.94 fps", rate: { numerator: 60_000, denominator: 1_001 } },
	{ id: "60", label: "60 fps", rate: { numerator: 60, denominator: 1 } },
];

export function frameRateOptionId({ rate }: { rate: FrameRate }): string | null {
	const match = EXPORT_FRAME_RATE_OPTIONS.find(
		(option) =>
			option.rate.numerator === rate.numerator &&
			option.rate.denominator === rate.denominator,
	);
	return match?.id ?? null;
}

export function formatFrameRateLabel({ rate }: { rate: FrameRate }): string {
	const knownId = frameRateOptionId({ rate });
	if (knownId) {
		return EXPORT_FRAME_RATE_OPTIONS.find((o) => o.id === knownId)?.label ?? knownId;
	}
	const value = rate.numerator / rate.denominator;
	return `${Number.isInteger(value) ? value : value.toFixed(3)} fps`;
}
