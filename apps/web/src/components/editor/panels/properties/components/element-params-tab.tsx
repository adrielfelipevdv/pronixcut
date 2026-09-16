"use client";

import { resolveAnimationPathValueAtTime } from "@/animation";
import { Section, SectionContent, SectionFields } from "@/components/section";
import { useElementPlayhead } from "@/components/editor/panels/properties/hooks/use-element-playhead";
import { useKeyframedParamProperty } from "@/components/editor/panels/properties/hooks/use-keyframed-param-property";
import { PropertyParamField } from "@/components/editor/panels/properties/components/property-param-field";
import type { ParamValue, ParamValues } from "@/params";
import {
	getElementParams,
	readElementParamValue,
	writeElementParamValue,
	type ElementParamDefinition,
} from "@/params/registry";
import type { TimelineElement } from "@/timeline";
import type { MediaTime } from "@/wasm";

export function ElementParamsTab({
	element,
	trackId,
	paramKeys,
	sectionKey,
	fieldLayout = "stack",
}: {
	element: TimelineElement;
	trackId: string;
	paramKeys?: readonly string[];
	sectionKey: string;
	fieldLayout?: "stack" | "row";
}) {
	const { localTime, isPlayheadWithinElementRange } = useElementPlayhead({
		startTime: element.startTime,
		duration: element.duration,
	});
	const params = getElementParams({ element }).filter(
		(param) => !paramKeys || paramKeys.includes(param.key),
	);
	const baseValues = buildValues({ element, params });

	return (
		<Section sectionKey={`${element.id}:${sectionKey}`}>
			<SectionContent className="pt-4">
				<SectionFields>
					{params
						.filter((param) => isVisible({ param, values: baseValues }))
						.map((param) => (
							<ElementParamField
								key={param.key}
								element={element}
								trackId={trackId}
								param={param}
								baseValue={baseValues[param.key] ?? param.default}
								localTime={localTime}
								isPlayheadWithinElementRange={isPlayheadWithinElementRange}
								layout={fieldLayout}
							/>
						))}
				</SectionFields>
			</SectionContent>
		</Section>
	);
}

function ElementParamField({
	element,
	trackId,
	param,
	baseValue,
	localTime,
	isPlayheadWithinElementRange,
	layout,
}: {
	element: TimelineElement;
	trackId: string;
	param: ElementParamDefinition;
	baseValue: ParamValue;
	localTime: MediaTime;
	isPlayheadWithinElementRange: boolean;
	layout: "stack" | "row";
}) {
	const field = useElementParamField({
		element,
		trackId,
		param,
		baseValue,
		localTime,
		isPlayheadWithinElementRange,
	});

	// A multiline textarea (the caption/text content itself) never fits a
	// compact label-left/control-right row — it always gets its own full-width
	// block regardless of what the rest of the tab uses.
	const effectiveLayout = param.type === "text" ? "stack" : layout;

	return (
		<PropertyParamField
			param={param}
			value={field.value}
			onPreview={field.onPreview}
			onCommit={field.onCommit}
			keyframe={field.keyframe}
			layout={effectiveLayout}
		/>
	);
}

/**
 * Resolves a single param's animated value + keyframe wiring, without
 * rendering anything — lets bespoke tab layouts (e.g. the compact transform
 * fields) compose their own controls around the same real state/commands
 * used by the generic per-param loop above.
 */
export function useElementParamField({
	element,
	trackId,
	param,
	baseValue,
	localTime,
	isPlayheadWithinElementRange,
}: {
	element: TimelineElement;
	trackId: string;
	param: ElementParamDefinition;
	baseValue: ParamValue;
	localTime: MediaTime;
	isPlayheadWithinElementRange: boolean;
}): {
	value: ParamValue;
	onPreview: (value: ParamValue) => void;
	onCommit: () => void;
	keyframe?: { isActive: boolean; isDisabled: boolean; onToggle: () => void };
} {
	const resolvedValue = resolveAnimationPathValueAtTime({
		animations: element.animations,
		propertyPath: param.key,
		localTime,
		fallbackValue: baseValue,
	});
	const animatedParam = useKeyframedParamProperty({
		param,
		trackId,
		elementId: element.id,
		animations: element.animations,
		propertyPath: param.key,
		localTime,
		isPlayheadWithinElementRange,
		resolvedValue,
		buildBaseUpdates: ({ value }) =>
			writeElementParamValue({ element, param, value }),
	});

	return {
		value: resolvedValue,
		onPreview: animatedParam.onPreview,
		onCommit: animatedParam.onCommit,
		keyframe:
			param.keyframable === false
				? undefined
				: {
						isActive: animatedParam.isKeyframedAtTime,
						isDisabled: !isPlayheadWithinElementRange,
						onToggle: animatedParam.toggleKeyframe,
					},
	};
}

/** Reads a single param's current base value + resolves the param definition, for use outside the generic per-tab loop. */
export function useSingleElementParamValue({
	element,
	key,
}: {
	element: TimelineElement;
	key: string;
}): { param: ElementParamDefinition; baseValue: ParamValue } | null {
	const param = getElementParams({ element }).find((p) => p.key === key);
	if (!param) return null;
	const value = readElementParamValue({ element, param });
	return { param, baseValue: value ?? param.default };
}

function buildValues({
	element,
	params,
}: {
	element: TimelineElement;
	params: readonly ElementParamDefinition[];
}): ParamValues {
	const values: ParamValues = {};
	for (const param of params) {
		const value = readElementParamValue({ element, param });
		if (value !== null) {
			values[param.key] = value;
		}
	}
	return values;
}

function isVisible({
	param,
	values,
}: {
	param: ElementParamDefinition;
	values: ParamValues;
}): boolean {
	return (param.dependencies ?? []).every((dependency) =>
		areParamValuesEqual({
			left: values[dependency.param],
			right: dependency.equals,
		}),
	);
}

function areParamValuesEqual({
	left,
	right,
}: {
	left: ParamValue | undefined;
	right: ParamValue;
}): boolean {
	return left === right;
}
