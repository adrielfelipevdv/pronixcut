"use client";

import { useState } from "react";
import {
	Section,
	SectionContent,
	SectionHeader,
	SectionTitle,
	SectionFields,
	SectionField,
} from "@/components/section";
import { Input } from "@/components/ui/input";
import { useEditor } from "@/editor/use-editor";
import { BatchCommand, UpsertKeyframeCommand } from "@/commands";
import {
	mediaTime,
	mediaTimeFromSeconds,
	mediaTimeToSeconds,
	subMediaTime,
	type MediaTime,
} from "@/wasm";

const ZERO = mediaTime({ ticks: 0 });
const MIN_FADE_GAP_SECONDS = 0.05;

/**
 * "Fade in / Fade out" — a real, one-click convenience over the existing
 * keyframe system (UpsertKeyframeCommand on opacity/volume), matching what
 * CapCut/Premiere expose as a dedicated control instead of requiring the
 * user to place keyframes manually. Only adds keyframes (doesn't clear a
 * previously-set fade if reduced back to 0) — a simple, honest first pass.
 */
export function FadeControls({
	trackId,
	elementId,
	duration,
	propertyPath,
	baseValue,
	silentValue,
	label,
}: {
	trackId: string;
	elementId: string;
	duration: MediaTime;
	propertyPath: "opacity" | "volume";
	/** Value the property holds outside the fade (e.g. 1 for opacity, the clip's own dB level for volume). */
	baseValue: number;
	/** Value the property should reach at the very edge of the fade (0 for opacity, VOLUME_DB_MIN for volume — volume is in dB, so 0 there is unity gain, not silence). */
	silentValue: number;
	label: string;
}) {
	const editor = useEditor();
	const [fadeIn, setFadeIn] = useState("0");
	const [fadeOut, setFadeOut] = useState("0");

	const durationSeconds = mediaTimeToSeconds({ time: duration });
	const maxFade = Math.max(0, durationSeconds / 2 - MIN_FADE_GAP_SECONDS);

	const clamp = (value: number) => Math.min(Math.max(0, value), maxFade);

	const applyFadeIn = (seconds: number) => {
		const clamped = clamp(seconds);
		setFadeIn(String(clamped));
		if (clamped <= 0) return;
		const fadeTime = mediaTimeFromSeconds({ seconds: clamped });
		editor.command.execute({
			command: new BatchCommand([
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath,
					time: ZERO,
					value: silentValue,
					interpolation: "linear",
				}),
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath,
					time: fadeTime,
					value: baseValue,
					interpolation: "linear",
				}),
			]),
		});
	};

	const applyFadeOut = (seconds: number) => {
		const clamped = clamp(seconds);
		setFadeOut(String(clamped));
		if (clamped <= 0) return;
		const fadeSpan = mediaTimeFromSeconds({ seconds: clamped });
		const fadeStart = subMediaTime({ a: duration, b: fadeSpan });
		editor.command.execute({
			command: new BatchCommand([
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath,
					time: fadeStart,
					value: baseValue,
					interpolation: "linear",
				}),
				new UpsertKeyframeCommand({
					trackId,
					elementId,
					propertyPath,
					time: duration,
					value: silentValue,
					interpolation: "linear",
				}),
			]),
		});
	};

	return (
		<Section showTopBorder={false} sectionKey={`fade:${elementId}:${propertyPath}`} collapsible>
			<SectionHeader>
				<SectionTitle className="flex-1">{label}</SectionTitle>
			</SectionHeader>
			<SectionContent className="px-4 pb-3">
				<SectionFields>
					<SectionField label="Fade in (s)">
						<Input
							type="number"
							min={0}
							step={0.1}
							value={fadeIn}
							onChange={(event) => setFadeIn(event.target.value)}
							onBlur={(event) => applyFadeIn(Number(event.target.value) || 0)}
						/>
					</SectionField>
					<SectionField label="Fade out (s)">
						<Input
							type="number"
							min={0}
							step={0.1}
							value={fadeOut}
							onChange={(event) => setFadeOut(event.target.value)}
							onBlur={(event) => applyFadeOut(Number(event.target.value) || 0)}
						/>
					</SectionField>
				</SectionFields>
			</SectionContent>
		</Section>
	);
}
