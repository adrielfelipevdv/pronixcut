import { useEditor } from "@/editor/use-editor";
import { useElementSelection } from "@/timeline/hooks/element/use-element-selection";
import type { ImageElement, VideoElement } from "@/timeline";

export type GradeableElement = VideoElement | ImageElement;

/**
 * Resolves the single selected video/image element (if any) eligible for
 * color grading — Avançado/HSL/Curvas/LUT only ever edit video or image
 * clips, never audio/text/stickers/graphics.
 */
export function useSelectedGradeableElement(): {
	element: GradeableElement | null;
	trackId: string | null;
	selectionState: "none" | "multiple" | "unsupported" | "ready";
} {
	const editor = useEditor();
	useEditor((e) => e.scenes.getActiveSceneOrNull());
	const { selectedElements } = useElementSelection();

	if (selectedElements.length === 0) {
		return { element: null, trackId: null, selectionState: "none" };
	}
	if (selectedElements.length > 1) {
		return { element: null, trackId: null, selectionState: "multiple" };
	}

	const [{ trackId, elementId }] = selectedElements;
	const elementsWithTracks = editor.timeline.getElementsWithTracks({
		elements: [{ trackId, elementId }],
	});
	const found = elementsWithTracks[0];
	if (!found) {
		return { element: null, trackId: null, selectionState: "none" };
	}
	if (found.element.type !== "video" && found.element.type !== "image") {
		return { element: null, trackId: null, selectionState: "unsupported" };
	}

	return {
		element: found.element as GradeableElement,
		trackId: found.track.id,
		selectionState: "ready",
	};
}
