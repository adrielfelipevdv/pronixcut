import type { ParamValues } from "@/params";

export interface ViralTitlePreset {
	id: string;
	name: string;
	/** A flat patch merged into the text element's `params` — same shape/keys as the params registered in `textElementParams` (params/registry.ts). */
	values: ParamValues;
}

export interface CustomViralTitlePreset extends ViralTitlePreset {
	createdAt: string;
}
