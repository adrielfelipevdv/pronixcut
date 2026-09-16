import type { ReactNode } from "react";
import type {
	EffectElement,
	GraphicElement,
	ImageElement,
	InstagramQuestionElement,
	MaskableElement,
	RetimableElement,
	StickerElement,
	TextElement,
	VisualElement,
	VideoElement,
	AudioElement,
	TimelineElement,
} from "@/timeline";
import type { MediaAsset } from "@/media/types";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	TextFontIcon,
	ArrowExpandIcon,
	RainDropIcon,
	MusicNote03Icon,
	MagicWand05Icon,
	DashboardSpeed02Icon,
	SparklesIcon,
	MessageQuestionIcon,
} from "@hugeicons/core-free-icons";
import { ElementParamsTab } from "./components/element-params-tab";
import { FadeControls } from "./components/fade-controls";
import { TransformFields } from "./components/transform-fields";
import { VOLUME_DB_MIN } from "@/timeline/audio-constants";
import { ClipEffectsTab, StandaloneEffectTab } from "@/effects/components/effects-tab";
import { MasksTab } from "@/masks/components/masks-tab";
import { SpeedTab } from "@/speed/components/speed-tab";
import { GraphicTab } from "@/graphics/components/graphic-tab";
import { OcShapesIcon } from "@/components/icons";
import { SaveTextPresetButton } from "@/text/components/save-text-preset-button";
import { LoadTextPresetButton } from "@/text/components/load-text-preset-button";

const BLENDING_PARAM_KEYS = ["opacity", "blendMode"] as const;
const AUDIO_PARAM_KEYS = ["volume", "muted"] as const;

// The full set of style fields a text preset can save/apply — kept as one
// list independent of how the Inspector groups them into tabs (see
// text-preset-apply.ts). Do not remove keys from here without checking that
// consumer first.
export const TEXT_PARAM_KEYS = [
	"content",
	"fontFamily",
	"fontSize",
	"color",
	"textAlign",
	"fontWeight",
	"fontStyle",
	"textDecoration",
	"letterSpacing",
	"lineHeight",
	"background.enabled",
	"background.color",
	"background.cornerRadius",
	"background.paddingX",
	"background.paddingY",
	"background.offsetX",
	"background.offsetY",
] as const;

// "Texto" tab: just the content + core typography a caption/text box needs
// to read at a glance. Everything more stylistic lives in "Estilo".
const TEXT_CORE_PARAM_KEYS = [
	"content",
	"fontFamily",
	"fontWeight",
	"fontSize",
	"color",
	"textAlign",
	"letterSpacing",
	"lineHeight",
] as const;

// "Estilo" tab: decoration, background/fill and blending — the "how it's
// dressed" half of TEXT_PARAM_KEYS, plus the same opacity/blendMode fields
// every other visual element gets in its blending tab.
const TEXT_STYLE_PARAM_KEYS = [
	"fontStyle",
	"textDecoration",
	"background.enabled",
	"background.color",
	"background.cornerRadius",
	"background.paddingX",
	"background.paddingY",
	"background.offsetX",
	"background.offsetY",
	...BLENDING_PARAM_KEYS,
] as const;

const INSTAGRAM_QUESTION_CONTENT_PARAM_KEYS = [
	"header.content",
	"question.content",
] as const;

const INSTAGRAM_QUESTION_STYLE_PARAM_KEYS = [
	"fontFamily",
	"question.fontWeight",
	"question.fontSize",
	"header.fontSize",
	"card.headerColor",
	"card.bodyColor",
	"question.color",
	"header.color",
	"card.cornerRadius",
	"card.width",
	"card.paddingX",
	"card.headerPaddingY",
	"card.bodyPaddingY",
	"card.shadow",
	...BLENDING_PARAM_KEYS,
] as const;

export type TabContentProps = {
	trackId: string;
};

export type PropertiesTabDef = {
	id: string;
	label: string;
	icon: ReactNode;
	content: (props: TabContentProps) => ReactNode;
};

export type ElementPropertiesConfig = {
	defaultTab: string;
	tabs: PropertiesTabDef[];
};

function buildTransformTab({
	element,
}: {
	element: VisualElement;
}): PropertiesTabDef {
	return {
		id: "transform",
		label: "Ajustes",
		icon: <HugeiconsIcon icon={ArrowExpandIcon} size={16} />,
		content: ({ trackId }) => (
			<div className="p-3.5 pt-4">
				<TransformFields element={element} trackId={trackId} />
			</div>
		),
	};
}

function buildBlendingTab({
	element,
}: {
	element: VisualElement;
}): PropertiesTabDef {
	return {
		id: "blending",
		label: "Mesclagem",
		icon: <HugeiconsIcon icon={RainDropIcon} size={16} />,
		content: ({ trackId }) => (
			<>
				<ElementParamsTab
					element={element}
					trackId={trackId}
					paramKeys={BLENDING_PARAM_KEYS}
					sectionKey="blending"
				/>
				<FadeControls
					trackId={trackId}
					elementId={element.id}
					duration={element.duration}
					propertyPath="opacity"
					baseValue={
						typeof element.params.opacity === "number" ? element.params.opacity : 1
					}
					silentValue={0}
					label="Fade de vídeo"
				/>
			</>
		),
	};
}

function buildAudioTab({
	element,
}: {
	element: AudioElement | VideoElement;
}): PropertiesTabDef {
	return {
		id: "audio",
		label: "Áudio",
		icon: <HugeiconsIcon icon={MusicNote03Icon} size={16} />,
		content: ({ trackId }) => (
			<>
				<ElementParamsTab
					element={element}
					trackId={trackId}
					paramKeys={AUDIO_PARAM_KEYS}
					sectionKey="audio"
				/>
				<FadeControls
					trackId={trackId}
					elementId={element.id}
					duration={element.duration}
					propertyPath="volume"
					baseValue={
						typeof element.params.volume === "number" ? element.params.volume : 0
					}
					silentValue={VOLUME_DB_MIN}
					label="Fade de áudio"
				/>
			</>
		),
	};
}

function buildSpeedTab({
	element,
}: {
	element: RetimableElement;
}): PropertiesTabDef {
	return {
		id: "speed",
		label: "Velocidade",
		icon: <HugeiconsIcon icon={DashboardSpeed02Icon} size={16} />,
		content: ({ trackId }) => <SpeedTab element={element} trackId={trackId} />,
	};
}

function buildMasksTab({
	element,
}: {
	element: MaskableElement;
}): PropertiesTabDef {
	return {
		id: "masks",
		label: "Máscaras",
		icon: <OcShapesIcon size={16} />,
		content: ({ trackId }) => <MasksTab element={element} trackId={trackId} />,
	};
}

function buildClipEffectsTab({
	element,
}: {
	element: VisualElement;
}): PropertiesTabDef {
	return {
		id: "effects",
		label: "Efeitos",
		icon: <HugeiconsIcon icon={MagicWand05Icon} size={16} />,
		content: ({ trackId }) => (
			<ClipEffectsTab element={element} trackId={trackId} />
		),
	};
}

function buildTextTab({ element }: { element: TextElement }): PropertiesTabDef {
	return {
		id: "text",
		label: "Texto",
		icon: <HugeiconsIcon icon={TextFontIcon} size={16} />,
		content: ({ trackId }) => (
			<div className="flex flex-col">
				<ElementParamsTab
					element={element}
					trackId={trackId}
					paramKeys={TEXT_CORE_PARAM_KEYS}
					sectionKey="text"
					fieldLayout="row"
				/>
				<div className="flex items-center gap-2 px-3.5 pt-1 pb-3.5">
					<SaveTextPresetButton element={element} />
					<LoadTextPresetButton element={element} trackId={trackId} />
				</div>
			</div>
		),
	};
}

function buildTextStyleTab({
	element,
}: {
	element: TextElement;
}): PropertiesTabDef {
	return {
		id: "style",
		label: "Estilo",
		icon: <HugeiconsIcon icon={RainDropIcon} size={16} />,
		content: ({ trackId }) => (
			<>
				<ElementParamsTab
					element={element}
					trackId={trackId}
					paramKeys={TEXT_STYLE_PARAM_KEYS}
					sectionKey="text-style"
					fieldLayout="row"
				/>
				<div className="px-3.5">
					<FadeControls
						trackId={trackId}
						elementId={element.id}
						duration={element.duration}
						propertyPath="opacity"
						baseValue={
							typeof element.params.opacity === "number"
								? element.params.opacity
								: 1
						}
						silentValue={0}
						label="Fade de vídeo"
					/>
				</div>
			</>
		),
	};
}

function buildTextAnimationTab(): PropertiesTabDef {
	return {
		id: "animation",
		label: "Animação",
		icon: <HugeiconsIcon icon={SparklesIcon} size={16} />,
		content: () => (
			<div className="text-muted-foreground flex h-32 items-center justify-center px-4 text-center text-sm">
				Animações de texto ainda não estão disponíveis.
			</div>
		),
	};
}

function buildGraphicTab({
	element,
}: {
	element: GraphicElement;
}): PropertiesTabDef {
	return {
		id: "graphic",
		label: "Gráfico",
		icon: <OcShapesIcon size={16} />,
		content: ({ trackId }) => <GraphicTab element={element} trackId={trackId} />,
	};
}

function buildStandaloneEffectTab({
	element,
}: {
	element: EffectElement;
}): PropertiesTabDef {
	return {
		id: "effects",
		label: "Efeitos",
		icon: <HugeiconsIcon icon={MagicWand05Icon} size={16} />,
		content: ({ trackId }) => (
			<StandaloneEffectTab element={element} trackId={trackId} />
		),
	};
}

function getTextConfig({
	element,
}: {
	element: TextElement;
}): ElementPropertiesConfig {
	return {
		defaultTab: "text",
		tabs: [
			buildTextTab({ element }),
			buildTextStyleTab({ element }),
			buildTextAnimationTab(),
			buildTransformTab({ element }),
		],
	};
}

function getVideoConfig({
	element,
	mediaAsset,
}: {
	element: VideoElement;
	mediaAsset: MediaAsset | undefined;
}): ElementPropertiesConfig {
	const showAudioTab = mediaAsset?.hasAudio !== false;
	return {
		defaultTab: "transform",
		tabs: [
			buildTransformTab({ element }),
			...(showAudioTab ? [buildAudioTab({ element })] : []),
			buildSpeedTab({ element }),
			buildBlendingTab({ element }),
			buildMasksTab({ element }),
			buildClipEffectsTab({ element }),
		],
	};
}

function getImageConfig({
	element,
}: {
	element: ImageElement;
}): ElementPropertiesConfig {
	return {
		defaultTab: "transform",
		tabs: [
			buildTransformTab({ element }),
			buildBlendingTab({ element }),
			buildMasksTab({ element }),
			buildClipEffectsTab({ element }),
		],
	};
}

function getStickerConfig({
	element,
}: {
	element: StickerElement;
}): ElementPropertiesConfig {
	return {
		defaultTab: "transform",
		tabs: [
			buildTransformTab({ element }),
			buildBlendingTab({ element }),
			buildClipEffectsTab({ element }),
		],
	};
}

function getGraphicConfig({
	element,
}: {
	element: GraphicElement;
}): ElementPropertiesConfig {
	return {
		defaultTab: "graphic",
		tabs: [
			buildGraphicTab({ element }),
			buildTransformTab({ element }),
			buildBlendingTab({ element }),
			buildMasksTab({ element }),
			buildClipEffectsTab({ element }),
		],
	};
}

function buildInstagramQuestionContentTab({
	element,
}: {
	element: InstagramQuestionElement;
}): PropertiesTabDef {
	return {
		id: "content",
		label: "Conteúdo",
		icon: <HugeiconsIcon icon={MessageQuestionIcon} size={16} />,
		content: ({ trackId }) => (
			<ElementParamsTab
				element={element}
				trackId={trackId}
				paramKeys={INSTAGRAM_QUESTION_CONTENT_PARAM_KEYS}
				sectionKey="instagram-question-content"
			/>
		),
	};
}

function buildInstagramQuestionStyleTab({
	element,
}: {
	element: InstagramQuestionElement;
}): PropertiesTabDef {
	return {
		id: "style",
		label: "Estilo",
		icon: <HugeiconsIcon icon={RainDropIcon} size={16} />,
		content: ({ trackId }) => (
			<ElementParamsTab
				element={element}
				trackId={trackId}
				paramKeys={INSTAGRAM_QUESTION_STYLE_PARAM_KEYS}
				sectionKey="instagram-question-style"
				fieldLayout="row"
			/>
		),
	};
}

function getInstagramQuestionConfig({
	element,
}: {
	element: InstagramQuestionElement;
}): ElementPropertiesConfig {
	return {
		defaultTab: "content",
		tabs: [
			buildInstagramQuestionContentTab({ element }),
			buildInstagramQuestionStyleTab({ element }),
			buildTransformTab({ element }),
		],
	};
}

function getAudioConfig({
	element,
}: {
	element: AudioElement;
}): ElementPropertiesConfig {
	return {
		defaultTab: "audio",
		tabs: [buildAudioTab({ element }), buildSpeedTab({ element })],
	};
}

function getEffectConfig({
	element,
}: {
	element: EffectElement;
}): ElementPropertiesConfig {
	return {
		defaultTab: "effects",
		tabs: [buildStandaloneEffectTab({ element })],
	};
}

export function getPropertiesConfig({
	element,
	mediaAssets,
}: {
	element: TimelineElement;
	mediaAssets: MediaAsset[];
}): ElementPropertiesConfig {
	switch (element.type) {
		case "text":
			return getTextConfig({ element });
		case "video": {
			const mediaAsset = mediaAssets.find((a) => a.id === element.mediaId);
			return getVideoConfig({ element, mediaAsset });
		}
		case "image":
			return getImageConfig({ element });
		case "sticker":
			return getStickerConfig({ element });
		case "graphic":
			return getGraphicConfig({ element });
		case "instagramQuestion":
			return getInstagramQuestionConfig({ element });
		case "audio":
			return getAudioConfig({ element });
		case "effect":
			return getEffectConfig({ element });
	}
}
