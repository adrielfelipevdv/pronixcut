"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { AdjustmentRow } from "./adjustment-row";
import { NoClipSelected } from "./no-clip-selected";
import { useClipGradeEditor } from "../hooks/use-clip-grade-editor";
import { useSelectedGradeableElement } from "../hooks/use-selected-gradeable-element";
import type { AdjustmentRange } from "@/adjustments/types";
import { HSL_BAND_INFO, HSL_CHANNEL_KEYS, type HslChannelKey } from "@/effects/color-grade/hsl-bands";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowTurnBackwardIcon,
	Layers01Icon,
	Moon02Icon,
	Sun03Icon,
} from "@hugeicons/core-free-icons";
import { cn } from "@/utils/ui";

const RANGE_100: AdjustmentRange = { min: -100, max: 100, step: 1, decimals: 0 };

export function HslTab() {
	const { element, trackId, selectionState } = useSelectedGradeableElement();

	if (!element || !trackId) {
		return (
			<NoClipSelected
				message={
					selectionState === "multiple"
						? "Selecione apenas um clipe para editar o HSL."
						: undefined
				}
			/>
		);
	}

	return <HslTabContent element={element} trackId={trackId} />;
}

function HslTabContent({
	element,
	trackId,
}: {
	element: NonNullable<ReturnType<typeof useSelectedGradeableElement>["element"]>;
	trackId: string;
}) {
	const grade = useClipGradeEditor({ element, trackId });
	const [activeChannel, setActiveChannel] = useState<HslChannelKey>("red");
	const band = grade.hsl[activeChannel];
	const info = HSL_BAND_INFO[activeChannel];

	const setBand = (patch: Partial<typeof band>) => {
		grade.setHslBand(activeChannel, { ...band, ...patch });
	};

	return (
		<div className="flex flex-col">
			<div className="flex items-center justify-end px-4 py-2">
				<Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" onClick={grade.resetHsl}>
					<HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-3.5" />
					Redefinir HSL
				</Button>
			</div>

			<div className="flex flex-wrap items-center gap-2 px-4 pb-4">
				{HSL_CHANNEL_KEYS.map((key) => {
					const swatch = HSL_BAND_INFO[key];
					const isActive = key === activeChannel;
					const isDirty =
						grade.hsl[key].hue !== 0 ||
						grade.hsl[key].saturation !== 0 ||
						grade.hsl[key].lightness !== 0;
					return (
						<button
							key={key}
							type="button"
							title={swatch.label}
							onClick={() => setActiveChannel(key)}
							className={cn(
								"relative flex size-8 shrink-0 items-center justify-center rounded-full border-2 transition-transform duration-150",
								isActive
									? "border-primary scale-110"
									: "border-transparent hover:scale-105",
							)}
						>
							<span
								className="block size-6 rounded-full"
								style={{ backgroundColor: swatch.swatch }}
							/>
							{isDirty && (
								<span className="bg-primary border-background absolute -top-0.5 -right-0.5 size-2 rounded-full border" />
							)}
						</button>
					);
				})}
			</div>

			<div className="flex flex-col gap-1 px-4 pb-1">
				<span className="text-foreground text-sm font-semibold">{info.label}</span>
			</div>

			<div className="flex flex-col gap-4 px-4 pt-3 pb-6">
				<AdjustmentRow
					icon={Layers01Icon}
					label="Matiz"
					value={band.hue}
					range={RANGE_100}
					onChange={(value) => setBand({ hue: value })}
					onCommit={grade.commit}
				/>
				<AdjustmentRow
					icon={Sun03Icon}
					label="Saturação"
					value={band.saturation}
					range={RANGE_100}
					onChange={(value) => setBand({ saturation: value })}
					onCommit={grade.commit}
				/>
				<AdjustmentRow
					icon={Moon02Icon}
					label="Luminosidade"
					value={band.lightness}
					range={RANGE_100}
					onChange={(value) => setBand({ lightness: value })}
					onCommit={grade.commit}
				/>
			</div>
		</div>
	);
}
