"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { CurveEditor } from "./curve-editor";
import { NoClipSelected } from "./no-clip-selected";
import { useClipGradeEditor } from "../hooks/use-clip-grade-editor";
import { useSelectedGradeableElement } from "../hooks/use-selected-gradeable-element";
import { isIdentityCurve } from "@/effects/color-grade/curve-math";
import type { CurveChannelKey } from "@/effects/color-grade/advanced-types";
import { HugeiconsIcon } from "@hugeicons/react";
import { ArrowTurnBackwardIcon } from "@hugeicons/core-free-icons";
import { cn } from "@/utils/ui";

const CHANNELS: { key: CurveChannelKey; label: string; color: string }[] = [
	{ key: "rgb", label: "RGB", color: "#FFC600" },
	{ key: "red", label: "R", color: "#ef4444" },
	{ key: "green", label: "G", color: "#22c55e" },
	{ key: "blue", label: "B", color: "#3b82f6" },
];

export function CurvasTab() {
	const { element, trackId, selectionState } = useSelectedGradeableElement();

	if (!element || !trackId) {
		return (
			<NoClipSelected
				message={
					selectionState === "multiple"
						? "Selecione apenas um clipe para editar as curvas."
						: undefined
				}
			/>
		);
	}

	return <CurvasTabContent element={element} trackId={trackId} />;
}

function CurvasTabContent({
	element,
	trackId,
}: {
	element: NonNullable<ReturnType<typeof useSelectedGradeableElement>["element"]>;
	trackId: string;
}) {
	const grade = useClipGradeEditor({ element, trackId });
	const [activeChannel, setActiveChannel] = useState<CurveChannelKey>("rgb");
	const activeInfo = CHANNELS.find((c) => c.key === activeChannel) ?? CHANNELS[0];

	return (
		<div className="flex flex-col gap-4 px-4 py-4">
			<div className="flex items-center justify-between">
				<div className="border-border bg-accent flex items-center gap-0.5 rounded-md border p-0.5">
					{CHANNELS.map((channel) => {
						const isActive = channel.key === activeChannel;
						const isDirty = !isIdentityCurve(grade.curves[channel.key]);
						return (
							<button
								key={channel.key}
								type="button"
								onClick={() => setActiveChannel(channel.key)}
								className={cn(
									"relative flex h-7 min-w-9 items-center justify-center rounded-[5px] px-2 text-xs font-semibold transition-colors duration-150",
									isActive
										? "bg-primary/15 text-primary"
										: "text-muted-foreground hover:text-foreground",
								)}
							>
								{channel.label}
								{isDirty && (
									<span className="bg-primary absolute top-1 right-1 size-1.5 rounded-full" />
								)}
							</button>
						);
					})}
				</div>
				<Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" onClick={grade.resetCurves}>
					<HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-3.5" />
					Redefinir curva
				</Button>
			</div>

			<CurveEditor
				points={grade.curves[activeChannel]}
				color={activeInfo.color}
				onChange={(points) => grade.setCurve(activeChannel, points)}
				onCommit={grade.commit}
			/>

			<p className="text-muted-foreground text-xs">
				Clique na curva para adicionar um ponto. Arraste para ajustar. Clique
				duas vezes (ou clique com o botão direito) em um ponto para removê-lo.
			</p>
		</div>
	);
}
