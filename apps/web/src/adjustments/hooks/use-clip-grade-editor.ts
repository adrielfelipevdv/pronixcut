import { useEditor } from "@/editor/use-editor";
import { useElementPreview } from "@/timeline/hooks/use-element-preview";
import { findTrackInSceneTracks, type VisualElement } from "@/timeline";
import type { Effect } from "@/effects/types";
import { buildDefaultEffectInstance } from "@/effects";
import { COLOR_GRADE_EFFECT_TYPE } from "@/effects/color-grade/definition";
import {
	COLOR_GRADE_ADVANCED_PARAMS,
	COLOR_GRADE_NEUTRAL,
	readColorGradeValues,
	type ColorGradeValues,
} from "@/effects/color-grade/params";
import {
	isCurvesNeutral,
	readCurvesFromParams,
	readHslFromParams,
	readLutId,
	writeCurveChannelParam,
	writeHslParam,
	buildNeutralCurves,
	type CurveChannelKey,
	type CurvesValues,
} from "@/effects/color-grade/advanced-types";
import { buildNeutralHsl, isHslNeutral, type HslChannelKey, type HslValues } from "@/effects/color-grade/hsl-bands";
import type { GradeableElement } from "./use-selected-gradeable-element";
import type { ParamValue } from "@/params";

export interface ClipGradeEditor {
	values: ColorGradeValues;
	hsl: HslValues;
	curves: CurvesValues;
	lutId: string | null;
	isAdvancedDirty: boolean;
	isHslDirty: boolean;
	isCurvesDirty: boolean;
	isLutDirty: boolean;
	setParam: (key: keyof ColorGradeValues, value: number) => void;
	commit: () => void;
	setHslBand: (channel: HslChannelKey, band: HslValues[HslChannelKey]) => void;
	setCurve: (channel: CurveChannelKey, points: CurvesValues[CurveChannelKey]) => void;
	setLutId: (id: string | null) => void;
	resetAdvanced: () => void;
	resetHsl: () => void;
	resetCurves: () => void;
	resetLut: () => void;
}

const ADVANCED_KEYS = COLOR_GRADE_ADVANCED_PARAMS.map((p) => p.key as keyof ColorGradeValues);

export function useClipGradeEditor({
	element,
	trackId,
}: {
	element: GradeableElement;
	trackId: string;
}): ClipGradeEditor {
	const editor = useEditor();
	const { renderElement } = useElementPreview({
		trackId,
		elementId: element.id,
		fallback: element,
	});

	const effects: Effect[] = (renderElement as VisualElement).effects ?? [];
	const effect = effects.find((e) => e.type === COLOR_GRADE_EFFECT_TYPE) ?? null;
	const effectParams: Record<string, unknown> = effect?.params ?? {};

	const values = readColorGradeValues(effectParams);
	const hsl = readHslFromParams(effectParams);
	const curves = readCurvesFromParams(effectParams);
	const lutId = readLutId(effectParams);

	// Interaction bookkeeping is done against LIVE editor state (not React's
	// possibly-stale render of `effects` above), so rapid slider events within
	// one drag never race with re-renders — see file-level note below.
	const getFreshEffects = (): Effect[] => {
		const overlay = editor.timeline.getPreviewTracks();
		const tracks = overlay ?? editor.scenes.getActiveScene().tracks;
		const track = findTrackInSceneTracks({ tracks, trackId });
		const el = track?.elements.find((e) => e.id === element.id) as
			| VisualElement
			| undefined;
		return el?.effects ?? [];
	};

	const applyEffectsUpdate = (updates: Record<string, ParamValue>) => {
		const fresh = getFreshEffects();
		const existing = fresh.find((e) => e.type === COLOR_GRADE_EFFECT_TYPE);
		const nextEffects: Effect[] = existing
			? fresh.map((e) =>
					e.id === existing.id ? { ...e, params: { ...e.params, ...updates } } : e,
				)
			: [
					...fresh,
					{
						...buildDefaultEffectInstance({ effectType: COLOR_GRADE_EFFECT_TYPE }),
						params: {
							...buildDefaultEffectInstance({ effectType: COLOR_GRADE_EFFECT_TYPE }).params,
							...updates,
						},
					},
				];
		editor.timeline.previewElements({
			updates: [{ trackId, elementId: element.id, updates: { effects: nextEffects } }],
		});
	};

	const commit = () => editor.timeline.commitPreview();

	const setParam = (key: keyof ColorGradeValues, value: number) => {
		applyEffectsUpdate({ [key]: value });
	};

	const setHslBand = (channel: HslChannelKey, band: HslValues[HslChannelKey]) => {
		const nextHsl = { ...hsl, [channel]: band };
		applyEffectsUpdate({ [writeHslParam(nextHsl).key]: writeHslParam(nextHsl).value });
	};

	const setCurve = (channel: CurveChannelKey, points: CurvesValues[CurveChannelKey]) => {
		const written = writeCurveChannelParam({ channel, points });
		applyEffectsUpdate({ [written.key]: written.value });
	};

	const setLutId = (id: string | null) => {
		applyEffectsUpdate({ lutId: id ?? "" });
	};

	const resetAdvanced = () => {
		const updates: Record<string, ParamValue> = {};
		for (const key of ADVANCED_KEYS) {
			updates[key] = COLOR_GRADE_NEUTRAL[key];
		}
		applyEffectsUpdate(updates);
		commit();
	};

	const resetHsl = () => {
		const neutral = buildNeutralHsl();
		const written = writeHslParam(neutral);
		applyEffectsUpdate({ [written.key]: written.value });
		commit();
	};

	const resetCurves = () => {
		const neutral = buildNeutralCurves();
		const updates: Record<string, ParamValue> = {};
		for (const channel of Object.keys(neutral) as CurveChannelKey[]) {
			const written = writeCurveChannelParam({ channel, points: neutral[channel] });
			updates[written.key] = written.value;
		}
		applyEffectsUpdate(updates);
		commit();
	};

	const resetLut = () => {
		applyEffectsUpdate({ lutId: "", lutIntensity: COLOR_GRADE_NEUTRAL.lutIntensity });
		commit();
	};

	const isAdvancedDirty = ADVANCED_KEYS.some(
		(key) => key !== "lutIntensity" && values[key] !== COLOR_GRADE_NEUTRAL[key],
	);
	const isHslDirty = !isHslNeutral(hsl);
	const isCurvesDirty = !isCurvesNeutral(curves);
	const isLutDirty = Boolean(lutId);

	return {
		values,
		hsl,
		curves,
		lutId,
		isAdvancedDirty,
		isHslDirty,
		isCurvesDirty,
		isLutDirty,
		setParam,
		commit,
		setHslBand,
		setCurve,
		setLutId,
		resetAdvanced,
		resetHsl,
		resetCurves,
		resetLut,
	};
}
