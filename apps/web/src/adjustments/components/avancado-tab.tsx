"use client";

import {
	Section,
	SectionContent,
	SectionFields,
	SectionHeader,
	SectionTitle,
} from "@/components/section";
import { Button } from "@/components/ui/button";
import { AdjustmentRow } from "./adjustment-row";
import { NoClipSelected } from "./no-clip-selected";
import { useClipGradeEditor } from "../hooks/use-clip-grade-editor";
import { useSelectedGradeableElement } from "../hooks/use-selected-gradeable-element";
import type { AdjustmentRange } from "@/adjustments/types";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowExpand01Icon,
	ArrowTurnBackwardIcon,
	BlurIcon,
	CenterFocusIcon,
	LayersIcon,
	Moon01Icon,
	PaintBoardIcon,
	PulseIcon,
	Sun01Icon,
	Target01Icon,
	Target02Icon,
	Target03Icon,
	SparklesIcon,
} from "@hugeicons/core-free-icons";

const RANGE_100: AdjustmentRange = { min: -100, max: 100, step: 1, decimals: 0 };
const RANGE_0_100: AdjustmentRange = { min: 0, max: 100, step: 1, decimals: 0 };

export function AvancadoTab() {
	const { element, trackId, selectionState } = useSelectedGradeableElement();

	if (!element || !trackId) {
		return (
			<NoClipSelected
				message={
					selectionState === "multiple"
						? "Selecione apenas um clipe para editar os ajustes avançados."
						: undefined
				}
			/>
		);
	}

	return <AvancadoTabContent element={element} trackId={trackId} />;
}

function AvancadoTabContent({
	element,
	trackId,
}: {
	element: NonNullable<ReturnType<typeof useSelectedGradeableElement>["element"]>;
	trackId: string;
}) {
	const grade = useClipGradeEditor({ element, trackId });

	return (
		<div className="flex flex-col">
			<div className="flex items-center justify-end px-4 py-2">
				<Button variant="ghost" size="sm" className="text-muted-foreground gap-1.5" onClick={grade.resetAdvanced}>
					<HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-3.5" />
					Redefinir
				</Button>
			</div>

			<Section collapsible defaultOpen sectionKey="adjustments:advanced-color">
				<SectionHeader leading={<HugeiconsIcon icon={PaintBoardIcon} className="text-muted-foreground size-4" />}>
					<SectionTitle>Cor</SectionTitle>
				</SectionHeader>
				<SectionContent>
					<SectionFields className="gap-4">
						<AdjustmentRow
							icon={SparklesIcon}
							label="Intensidade da cor"
							value={grade.values.intensity}
							range={{ min: 0, max: 100, step: 1, decimals: 0 }}
							onChange={(value) => grade.setParam("intensity", value)}
						onCommit={grade.commit}
						/>
						<AdjustmentRow
							icon={LayersIcon}
							label="Fade"
							value={grade.values.fade}
							range={RANGE_0_100}
							onChange={(value) => grade.setParam("fade", value)}
						onCommit={grade.commit}
						/>
					</SectionFields>
				</SectionContent>
			</Section>

			<Section collapsible defaultOpen sectionKey="adjustments:advanced-light">
				<SectionHeader leading={<HugeiconsIcon icon={Sun01Icon} className="text-muted-foreground size-4" />}>
					<SectionTitle>Luz</SectionTitle>
				</SectionHeader>
				<SectionContent>
					<SectionFields className="gap-4">
						<AdjustmentRow
							icon={Sun01Icon}
							label="Realces"
							value={grade.values.highlights}
							range={RANGE_100}
							onChange={(value) => grade.setParam("highlights", value)}
						onCommit={grade.commit}
						/>
						<AdjustmentRow
							icon={Moon01Icon}
							label="Sombras"
							value={grade.values.shadows}
							range={RANGE_100}
							onChange={(value) => grade.setParam("shadows", value)}
						onCommit={grade.commit}
						/>
						<AdjustmentRow
							icon={Target01Icon}
							label="Brancos"
							value={grade.values.whites}
							range={RANGE_100}
							onChange={(value) => grade.setParam("whites", value)}
						onCommit={grade.commit}
						/>
						<AdjustmentRow
							icon={Target02Icon}
							label="Pretos"
							value={grade.values.blacks}
							range={RANGE_100}
							onChange={(value) => grade.setParam("blacks", value)}
						onCommit={grade.commit}
						/>
					</SectionFields>
				</SectionContent>
			</Section>

			<Section collapsible defaultOpen={false} sectionKey="adjustments:advanced-details">
				<SectionHeader leading={<HugeiconsIcon icon={CenterFocusIcon} className="text-muted-foreground size-4" />}>
					<SectionTitle>Detalhes</SectionTitle>
				</SectionHeader>
				<SectionContent>
					<SectionFields className="gap-4">
						<AdjustmentRow
							icon={CenterFocusIcon}
							label="Nitidez"
							value={grade.values.sharpness}
							range={RANGE_0_100}
							onChange={(value) => grade.setParam("sharpness", value)}
						onCommit={grade.commit}
						/>
						<AdjustmentRow
							icon={BlurIcon}
							label="Clareza"
							value={grade.values.clarity}
							range={RANGE_100}
							onChange={(value) => grade.setParam("clarity", value)}
						onCommit={grade.commit}
						/>
						<AdjustmentRow
							icon={PulseIcon}
							label="Redução de ruído"
							value={grade.values.noiseReduction}
							range={RANGE_0_100}
							onChange={(value) => grade.setParam("noiseReduction", value)}
						onCommit={grade.commit}
						/>
					</SectionFields>
				</SectionContent>
			</Section>

			<Section collapsible defaultOpen={false} sectionKey="adjustments:advanced-vignette">
				<SectionHeader leading={<HugeiconsIcon icon={Target03Icon} className="text-muted-foreground size-4" />}>
					<SectionTitle>Vinheta</SectionTitle>
				</SectionHeader>
				<SectionContent>
					<SectionFields className="gap-4">
						<AdjustmentRow
							icon={Target01Icon}
							label="Intensidade"
							value={grade.values.vignette}
							range={RANGE_0_100}
							onChange={(value) => grade.setParam("vignette", value)}
						onCommit={grade.commit}
						/>
						<AdjustmentRow
							icon={ArrowExpand01Icon}
							label="Tamanho"
							value={grade.values.vignetteSize}
							range={RANGE_0_100}
							onChange={(value) => grade.setParam("vignetteSize", value)}
						onCommit={grade.commit}
						/>
						<AdjustmentRow
							icon={BlurIcon}
							label="Suavidade"
							value={grade.values.vignetteFeather}
							range={RANGE_0_100}
							onChange={(value) => grade.setParam("vignetteFeather", value)}
						onCommit={grade.commit}
						/>
					</SectionFields>
				</SectionContent>
			</Section>

			<Section collapsible defaultOpen={false} sectionKey="adjustments:advanced-grain" showBottomBorder={false}>
				<SectionHeader leading={<HugeiconsIcon icon={PulseIcon} className="text-muted-foreground size-4" />}>
					<SectionTitle>Grão</SectionTitle>
				</SectionHeader>
				<SectionContent>
					<SectionFields className="gap-4">
						<AdjustmentRow
							icon={PulseIcon}
							label="Quantidade"
							value={grade.values.grain}
							range={RANGE_0_100}
							onChange={(value) => grade.setParam("grain", value)}
						onCommit={grade.commit}
						/>
						<AdjustmentRow
							icon={ArrowExpand01Icon}
							label="Tamanho"
							value={grade.values.grainSize}
							range={RANGE_0_100}
							onChange={(value) => grade.setParam("grainSize", value)}
						onCommit={grade.commit}
						/>
						<AdjustmentRow
							icon={BlurIcon}
							label="Suavidade"
							value={grade.values.grainSoftness}
							range={RANGE_0_100}
							onChange={(value) => grade.setParam("grainSoftness", value)}
						onCommit={grade.commit}
						/>
					</SectionFields>
				</SectionContent>
			</Section>
		</div>
	);
}
