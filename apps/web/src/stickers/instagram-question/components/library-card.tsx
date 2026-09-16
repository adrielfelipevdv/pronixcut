"use client";

import { useState } from "react";
import { toast } from "sonner";
import { DraggableItem } from "@/components/editor/panels/assets/draggable-item";
import { useEditor } from "@/editor/use-editor";
import { buildInstagramQuestionElement } from "@/timeline/element-utils";
import type { TimelineDragData } from "@/timeline/drag";
import { INSTAGRAM_QUESTION_DEFAULTS } from "@/stickers/instagram-question/card";
import { HugeiconsIcon } from "@hugeicons/react";
import { InstagramIcon } from "@hugeicons/core-free-icons";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/utils/ui";

const d = INSTAGRAM_QUESTION_DEFAULTS;

/** Static CSS thumbnail matching the real card's look — a cheap, fast
 * library-card preview instead of rendering the actual canvas node for a
 * static catalog entry. */
function InstagramQuestionCardPreview() {
	return (
		<div className="flex size-full flex-col overflow-hidden rounded-[10px] shadow-sm">
			<div
				className="flex items-center justify-center px-2 py-1.5 text-center text-[8px] font-medium text-white"
				style={{ backgroundColor: d.headerBgColor }}
			>
				{d.headerContent}
			</div>
			<div
				className="flex flex-1 items-center justify-center px-2 py-2 text-center text-[8.5px] leading-tight font-bold"
				style={{ backgroundColor: d.bodyBgColor, color: d.questionColor }}
			>
				{d.questionContent}
			</div>
		</div>
	);
}

export function InstagramQuestionSection() {
	return (
		<div className="flex flex-col gap-2">
			<div className="flex items-center gap-1.5">
				<HugeiconsIcon icon={InstagramIcon} className="text-muted-foreground size-3.5" />
				<p className="text-muted-foreground text-xs">Redes sociais</p>
			</div>
			<div className="grid grid-cols-2 gap-2">
				<InstagramQuestionLibraryItem />
			</div>
		</div>
	);
}

function InstagramQuestionLibraryItem() {
	const editor = useEditor();
	const [isAdding, setIsAdding] = useState(false);

	const handleAdd = async () => {
		setIsAdding(true);
		try {
			const currentTime = editor.playback.getCurrentTime();
			const element = buildInstagramQuestionElement({ startTime: currentTime });
			editor.timeline.insertElement({
				placement: { mode: "auto" },
				element,
			});
		} catch (error) {
			console.error("Failed to add Instagram question sticker:", error);
			toast.error("Falha ao adicionar a caixinha de perguntas");
		} finally {
			setIsAdding(false);
		}
	};

	const dragData: TimelineDragData = {
		id: "instagramQuestion:classic",
		type: "instagramQuestion",
		name: "Caixinha de perguntas",
	};

	return (
		<div className={cn("relative", isAdding && "pointer-events-none opacity-50")}>
			<DraggableItem
				name="Caixinha de perguntas"
				preview={<InstagramQuestionCardPreview />}
				dragData={dragData}
				onAddToTimeline={handleAdd}
				aspectRatio={16 / 10}
				shouldShowLabel
				isRounded
				variant="card"
				containerClassName="w-full"
			/>
			{isAdding && (
				<div className="absolute inset-0 z-10 flex items-center justify-center rounded-md bg-black/60">
					<Spinner className="size-6 text-white" />
				</div>
			)}
		</div>
	);
}
