import type { EditorCore } from "@/core";
import type { TextElement } from "@/timeline/types";
import { synthesizeWordTimings } from "./word-timing";
import type { ViralTitlePreset } from "./types";

export interface CaptionBlockRef {
	trackId: string;
	element: TextElement;
}

/**
 * Applies a viral-title preset to one or more caption blocks as a SINGLE
 * undo step (mirrors `TimelineManager.updateElements`'s batching, the same
 * mechanism `toggleElementsVisibility` uses for bulk operations) — applying
 * to 20 captions is one history entry, not 20.
 */
export function applyViralTitlePreset({
	editor,
	blocks,
	preset,
}: {
	editor: EditorCore;
	blocks: CaptionBlockRef[];
	preset: ViralTitlePreset;
}): void {
	const updates = blocks.map(({ trackId, element }) => {
		const words =
			element.words && element.words.length > 0
				? element.words
				: synthesizeWordTimings({
						text: String(element.params.content ?? ""),
						duration: element.duration,
					});

		return {
			trackId,
			elementId: element.id,
			patch: {
				params: { ...element.params, ...preset.values },
				words,
			},
		};
	});

	editor.timeline.updateElements({ updates });
}
