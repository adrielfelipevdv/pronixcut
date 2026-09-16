import type { AnimationPath } from "@/animation/types";
import {
	mediaTimeFromSeconds,
	minMediaTime,
	ZERO_MEDIA_TIME,
	type MediaTime,
} from "@/wasm";

export interface TransformPresetKeyframe {
	propertyPath: AnimationPath;
	time: MediaTime;
	value: number;
}

export interface TransformPresetDefinition {
	id: string;
	name: string;
	/** Builds the concrete keyframes for one clip, clamped to its duration. */
	build: ({ duration }: { duration: MediaTime }) => TransformPresetKeyframe[];
}

/** Second keyframe's time — a short, punchy default that still fits inside very short clips. */
function presetEndTime({
	duration,
	seconds,
}: {
	duration: MediaTime;
	seconds: number;
}): MediaTime {
	return minMediaTime({ a: mediaTimeFromSeconds({ seconds }), b: duration });
}

export const TRANSFORM_PRESETS: TransformPresetDefinition[] = [
	{
		id: "zoom-in",
		name: "Zoom In",
		build: ({ duration }) => {
			const end = presetEndTime({ duration, seconds: 1 });
			return [
				{ propertyPath: "transform.scaleX", time: ZERO_MEDIA_TIME, value: 1 },
				{ propertyPath: "transform.scaleY", time: ZERO_MEDIA_TIME, value: 1 },
				{ propertyPath: "transform.scaleX", time: end, value: 1.2 },
				{ propertyPath: "transform.scaleY", time: end, value: 1.2 },
			];
		},
	},
	{
		id: "zoom-out",
		name: "Zoom Out",
		build: ({ duration }) => {
			const end = presetEndTime({ duration, seconds: 1 });
			return [
				{ propertyPath: "transform.scaleX", time: ZERO_MEDIA_TIME, value: 1.2 },
				{ propertyPath: "transform.scaleY", time: ZERO_MEDIA_TIME, value: 1.2 },
				{ propertyPath: "transform.scaleX", time: end, value: 1 },
				{ propertyPath: "transform.scaleY", time: end, value: 1 },
			];
		},
	},
	{
		id: "push-left",
		name: "Push Left",
		build: ({ duration }) => {
			const end = presetEndTime({ duration, seconds: 0.6 });
			return [
				{ propertyPath: "transform.positionX", time: ZERO_MEDIA_TIME, value: 260 },
				{ propertyPath: "transform.positionX", time: end, value: 0 },
			];
		},
	},
	{
		id: "push-right",
		name: "Push Right",
		build: ({ duration }) => {
			const end = presetEndTime({ duration, seconds: 0.6 });
			return [
				{ propertyPath: "transform.positionX", time: ZERO_MEDIA_TIME, value: -260 },
				{ propertyPath: "transform.positionX", time: end, value: 0 },
			];
		},
	},
	{
		id: "slide-up",
		name: "Slide Up",
		build: ({ duration }) => {
			const end = presetEndTime({ duration, seconds: 0.6 });
			return [
				{ propertyPath: "transform.positionY", time: ZERO_MEDIA_TIME, value: 260 },
				{ propertyPath: "transform.positionY", time: end, value: 0 },
			];
		},
	},
	{
		id: "slide-down",
		name: "Slide Down",
		build: ({ duration }) => {
			const end = presetEndTime({ duration, seconds: 0.6 });
			return [
				{ propertyPath: "transform.positionY", time: ZERO_MEDIA_TIME, value: -260 },
				{ propertyPath: "transform.positionY", time: end, value: 0 },
			];
		},
	},
	{
		id: "punch-zoom",
		name: "Punch Zoom",
		build: ({ duration }) => {
			const mid = presetEndTime({ duration, seconds: 0.15 });
			const end = presetEndTime({ duration, seconds: 0.3 });
			return [
				{ propertyPath: "transform.scaleX", time: ZERO_MEDIA_TIME, value: 1 },
				{ propertyPath: "transform.scaleY", time: ZERO_MEDIA_TIME, value: 1 },
				{ propertyPath: "transform.scaleX", time: mid, value: 1.12 },
				{ propertyPath: "transform.scaleY", time: mid, value: 1.12 },
				{ propertyPath: "transform.scaleX", time: end, value: 1 },
				{ propertyPath: "transform.scaleY", time: end, value: 1 },
			];
		},
	},
	{
		id: "soft-entrance",
		name: "Entrada suave",
		build: ({ duration }) => {
			const end = presetEndTime({ duration, seconds: 0.4 });
			return [
				{ propertyPath: "opacity", time: ZERO_MEDIA_TIME, value: 0 },
				{ propertyPath: "transform.scaleX", time: ZERO_MEDIA_TIME, value: 0.9 },
				{ propertyPath: "transform.scaleY", time: ZERO_MEDIA_TIME, value: 0.9 },
				{ propertyPath: "opacity", time: end, value: 1 },
				{ propertyPath: "transform.scaleX", time: end, value: 1 },
				{ propertyPath: "transform.scaleY", time: end, value: 1 },
			];
		},
	},
];
