export interface AdjustmentValues {
	// Tom e Cor
	exposure: number;
	contrast: number;
	brightness: number;
	saturation: number;
	temperature: number;
	tint: number;
	vibrance: number;
	// Luz e Sombra
	highlights: number;
	shadows: number;
	whites: number;
	blacks: number;
	// Detalhes
	sharpness: number;
	clarity: number;
	noiseReduction: number;
	// Vinheta
	vignetteAmount: number;
	vignetteFeather: number;
	vignetteSize: number;
	// Estabilização
	stabilizationStrength: number;
	stabilizationSmoothness: number;
	stabilizationAutoCrop: boolean;
}

export type AdjustmentSliderKey = {
	[K in keyof AdjustmentValues]: AdjustmentValues[K] extends number ? K : never;
}[keyof AdjustmentValues];

export interface AdjustmentRange {
	min: number;
	max: number;
	step: number;
	decimals: number;
}

export const ADJUSTMENT_DEFAULTS: AdjustmentValues = {
	exposure: 0,
	contrast: 0,
	brightness: 0,
	saturation: 0,
	temperature: 0,
	tint: 0,
	vibrance: 0,
	highlights: 0,
	shadows: 0,
	whites: 0,
	blacks: 0,
	sharpness: 0,
	clarity: 0,
	noiseReduction: 0,
	vignetteAmount: 0,
	vignetteFeather: 50,
	vignetteSize: 50,
	stabilizationStrength: 0,
	stabilizationSmoothness: 50,
	stabilizationAutoCrop: false,
};

export const ADJUSTMENT_RANGES: Record<AdjustmentSliderKey, AdjustmentRange> = {
	exposure: { min: -1, max: 1, step: 0.01, decimals: 1 },
	contrast: { min: -100, max: 100, step: 1, decimals: 0 },
	brightness: { min: -100, max: 100, step: 1, decimals: 0 },
	saturation: { min: -100, max: 100, step: 1, decimals: 0 },
	temperature: { min: -100, max: 100, step: 1, decimals: 0 },
	tint: { min: -100, max: 100, step: 1, decimals: 0 },
	vibrance: { min: -100, max: 100, step: 1, decimals: 0 },
	highlights: { min: -100, max: 100, step: 1, decimals: 0 },
	shadows: { min: -100, max: 100, step: 1, decimals: 0 },
	whites: { min: -100, max: 100, step: 1, decimals: 0 },
	blacks: { min: -100, max: 100, step: 1, decimals: 0 },
	sharpness: { min: 0, max: 100, step: 1, decimals: 0 },
	clarity: { min: -100, max: 100, step: 1, decimals: 0 },
	noiseReduction: { min: 0, max: 100, step: 1, decimals: 0 },
	vignetteAmount: { min: -100, max: 100, step: 1, decimals: 0 },
	vignetteFeather: { min: 0, max: 100, step: 1, decimals: 0 },
	vignetteSize: { min: 0, max: 100, step: 1, decimals: 0 },
	stabilizationStrength: { min: 0, max: 100, step: 1, decimals: 0 },
	stabilizationSmoothness: { min: 0, max: 100, step: 1, decimals: 0 },
};
