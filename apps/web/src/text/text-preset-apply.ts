import {
	getElementParams,
	readElementParamValue,
	writeElementParamValue,
} from "@/params/registry";
import type { ParamValues } from "@/params";
import { TEXT_PARAM_KEYS } from "@/components/editor/panels/properties/registry";
import type { TextElement, TimelineElement } from "@/timeline";

// A style preset never carries the literal text — only how it looks.
// Applying a preset to a different text element must never overwrite what
// the user typed.
export const TEXT_STYLE_PARAM_KEYS = TEXT_PARAM_KEYS.filter(
	(key) => key !== "content",
);

/** Reads the current style values off a text element, in preset-storable form. */
export function readTextStyleValues({
	element,
}: {
	element: TextElement;
}): ParamValues {
	const params = getElementParams({ element }).filter((param) =>
		(TEXT_STYLE_PARAM_KEYS as readonly string[]).includes(param.key),
	);
	const values: ParamValues = {};
	for (const param of params) {
		const value = readElementParamValue({ element, param });
		if (value !== null) {
			values[param.key] = value;
		}
	}
	return values;
}

/**
 * Applies a saved style preset onto a text element, returning only the
 * `params` patch (content/position/timing on the target element are left
 * untouched) — ready to pass straight into UpdateElementsCommand.
 */
export function applyTextStyleValues({
	element,
	values,
}: {
	element: TextElement;
	values: ParamValues;
}): TextElement["params"] {
	const params = getElementParams({ element }).filter(
		(param) =>
			(TEXT_STYLE_PARAM_KEYS as readonly string[]).includes(param.key) &&
			values[param.key] !== undefined,
	);

	let working: TimelineElement = element;
	for (const param of params) {
		const value = values[param.key];
		if (value === undefined) continue;
		working = writeElementParamValue({
			element: working,
			param,
			value,
		});
	}
	return working.type === "text" ? working.params : element.params;
}
