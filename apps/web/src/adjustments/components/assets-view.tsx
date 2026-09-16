"use client";

import {
	Section,
	SectionContent,
	SectionFields,
	SectionHeader,
	SectionTitle,
} from "@/components/section";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";
import { useAdjustmentsStore } from "@/adjustments/adjustments-store";
import { ADJUSTMENT_RANGES } from "@/adjustments/types";
import { AdjustmentRow } from "./adjustment-row";
import { AvancadoTab } from "./avancado-tab";
import { HslTab } from "./hsl-tab";
import { CurvasTab } from "./curvas-tab";
import { LutTab } from "./lut-tab";
import { HugeiconsIcon } from "@hugeicons/react";
import {
	ArrowExpand01Icon,
	ArrowTurnBackwardIcon,
	BalanceScaleIcon,
	BlurIcon,
	CenterFocusIcon,
	ColorsIcon,
	Compass01Icon,
	CropIcon,
	DropletIcon,
	FlashlightIcon,
	FocusPointIcon,
	HighlighterIcon,
	Moon01Icon,
	Moon02Icon,
	PaintBoardIcon,
	PaintBrush01Icon,
	PulseIcon,
	Sun01Icon,
	Target01Icon,
	Target02Icon,
	Target03Icon,
	ThermometerIcon,
} from "@hugeicons/core-free-icons";

const TEMPERATURE_GRADIENT =
	"linear-gradient(90deg, #2f6fed 0%, rgba(255,255,255,0.12) 50%, #FFC600 100%)";
const TINT_GRADIENT =
	"linear-gradient(90deg, #20d98b 0%, rgba(255,255,255,0.12) 50%, #ff3b4e 100%)";

export function AdjustmentsView() {
	const values = useAdjustmentsStore((s) => s.values);
	const setValue = useAdjustmentsStore((s) => s.setValue);
	const setAutoCrop = useAdjustmentsStore((s) => s.setAutoCrop);
	const reset = useAdjustmentsStore((s) => s.reset);

	return (
		<div className="flex h-full flex-col">
			<div className="bg-background border-border flex h-11 shrink-0 items-center justify-between border-b pr-2 pl-3.5">
				<span className="text-foreground text-[15px] font-semibold">
					Ajustes
				</span>
				<Button variant="outline" size="sm" className="gap-1.5" onClick={reset}>
					<HugeiconsIcon icon={ArrowTurnBackwardIcon} className="size-3.5" />
					Redefinir
				</Button>
			</div>

			<Tabs defaultValue="basic" variant="underline" className="flex min-h-0 flex-1 flex-col">
				<TabsList aria-label="Modo de ajuste" className="shrink-0">
					<TabsTrigger value="basic">Básico</TabsTrigger>
					<TabsTrigger value="advanced">Avançado</TabsTrigger>
					<TabsTrigger value="hsl">HSL</TabsTrigger>
					<TabsTrigger value="curves">Curvas</TabsTrigger>
					<TabsTrigger value="lut">LUT</TabsTrigger>
				</TabsList>

				<TabsContent value="basic" className="min-h-0 flex-1 overflow-y-auto px-0! pb-4">
					<Section collapsible defaultOpen sectionKey="adjustments:tone-color">
						<SectionHeader leading={<HugeiconsIcon icon={PaintBoardIcon} className="text-muted-foreground size-4" />}>
							<SectionTitle>Tom e Cor</SectionTitle>
						</SectionHeader>
						<SectionContent>
							<SectionFields className="gap-4">
								<AdjustmentRow
									icon={Sun01Icon}
									label="Exposição"
									value={values.exposure}
									range={ADJUSTMENT_RANGES.exposure}
									onChange={(value) => setValue("exposure", value)}
								/>
								<AdjustmentRow
									icon={Moon02Icon}
									label="Contraste"
									value={values.contrast}
									range={ADJUSTMENT_RANGES.contrast}
									onChange={(value) => setValue("contrast", value)}
								/>
								<AdjustmentRow
									icon={FlashlightIcon}
									label="Brilho"
									value={values.brightness}
									range={ADJUSTMENT_RANGES.brightness}
									onChange={(value) => setValue("brightness", value)}
								/>
								<AdjustmentRow
									icon={DropletIcon}
									label="Saturação"
									value={values.saturation}
									range={ADJUSTMENT_RANGES.saturation}
									onChange={(value) => setValue("saturation", value)}
								/>
								<AdjustmentRow
									icon={ThermometerIcon}
									label="Temperatura"
									value={values.temperature}
									range={ADJUSTMENT_RANGES.temperature}
									trackGradient={TEMPERATURE_GRADIENT}
									onChange={(value) => setValue("temperature", value)}
								/>
								<AdjustmentRow
									icon={ColorsIcon}
									label="Matiz"
									value={values.tint}
									range={ADJUSTMENT_RANGES.tint}
									trackGradient={TINT_GRADIENT}
									onChange={(value) => setValue("tint", value)}
								/>
								<AdjustmentRow
									icon={PaintBrush01Icon}
									label="Vibração"
									value={values.vibrance}
									range={ADJUSTMENT_RANGES.vibrance}
									onChange={(value) => setValue("vibrance", value)}
								/>
							</SectionFields>
						</SectionContent>
					</Section>

					<Section collapsible defaultOpen={false} sectionKey="adjustments:light-shadow">
						<SectionHeader leading={<HugeiconsIcon icon={HighlighterIcon} className="text-muted-foreground size-4" />}>
							<SectionTitle>Luz e Sombra</SectionTitle>
						</SectionHeader>
						<SectionContent>
							<SectionFields className="gap-4">
								<AdjustmentRow
									icon={Sun01Icon}
									label="Realces"
									value={values.highlights}
									range={ADJUSTMENT_RANGES.highlights}
									onChange={(value) => setValue("highlights", value)}
								/>
								<AdjustmentRow
									icon={Moon01Icon}
									label="Sombras"
									value={values.shadows}
									range={ADJUSTMENT_RANGES.shadows}
									onChange={(value) => setValue("shadows", value)}
								/>
								<AdjustmentRow
									icon={Target01Icon}
									label="Brancos"
									value={values.whites}
									range={ADJUSTMENT_RANGES.whites}
									onChange={(value) => setValue("whites", value)}
								/>
								<AdjustmentRow
									icon={Target02Icon}
									label="Pretos"
									value={values.blacks}
									range={ADJUSTMENT_RANGES.blacks}
									onChange={(value) => setValue("blacks", value)}
								/>
							</SectionFields>
						</SectionContent>
					</Section>

					<Section collapsible defaultOpen={false} sectionKey="adjustments:details">
						<SectionHeader leading={<HugeiconsIcon icon={FocusPointIcon} className="text-muted-foreground size-4" />}>
							<SectionTitle>Detalhes</SectionTitle>
						</SectionHeader>
						<SectionContent>
							<SectionFields className="gap-4">
								<AdjustmentRow
									icon={CenterFocusIcon}
									label="Nitidez"
									value={values.sharpness}
									range={ADJUSTMENT_RANGES.sharpness}
									onChange={(value) => setValue("sharpness", value)}
								/>
								<AdjustmentRow
									icon={BlurIcon}
									label="Clareza"
									value={values.clarity}
									range={ADJUSTMENT_RANGES.clarity}
									onChange={(value) => setValue("clarity", value)}
								/>
								<AdjustmentRow
									icon={PulseIcon}
									label="Redução de ruído"
									value={values.noiseReduction}
									range={ADJUSTMENT_RANGES.noiseReduction}
									onChange={(value) => setValue("noiseReduction", value)}
								/>
							</SectionFields>
						</SectionContent>
					</Section>

					<Section collapsible defaultOpen={false} sectionKey="adjustments:vignette">
						<SectionHeader leading={<HugeiconsIcon icon={Target03Icon} className="text-muted-foreground size-4" />}>
							<SectionTitle>Vinheta</SectionTitle>
						</SectionHeader>
						<SectionContent>
							<SectionFields className="gap-4">
								<AdjustmentRow
									icon={Target01Icon}
									label="Intensidade"
									value={values.vignetteAmount}
									range={ADJUSTMENT_RANGES.vignetteAmount}
									onChange={(value) => setValue("vignetteAmount", value)}
								/>
								<AdjustmentRow
									icon={BlurIcon}
									label="Suavidade"
									value={values.vignetteFeather}
									range={ADJUSTMENT_RANGES.vignetteFeather}
									onChange={(value) => setValue("vignetteFeather", value)}
								/>
								<AdjustmentRow
									icon={ArrowExpand01Icon}
									label="Tamanho"
									value={values.vignetteSize}
									range={ADJUSTMENT_RANGES.vignetteSize}
									onChange={(value) => setValue("vignetteSize", value)}
								/>
							</SectionFields>
						</SectionContent>
					</Section>

					<Section collapsible defaultOpen={false} sectionKey="adjustments:stabilization" showBottomBorder={false}>
						<SectionHeader leading={<HugeiconsIcon icon={BalanceScaleIcon} className="text-muted-foreground size-4" />}>
							<SectionTitle>Estabilização</SectionTitle>
						</SectionHeader>
						<SectionContent>
							<SectionFields className="gap-4">
								<AdjustmentRow
									icon={Compass01Icon}
									label="Intensidade"
									value={values.stabilizationStrength}
									range={ADJUSTMENT_RANGES.stabilizationStrength}
									onChange={(value) => setValue("stabilizationStrength", value)}
								/>
								<AdjustmentRow
									icon={BlurIcon}
									label="Suavidade"
									value={values.stabilizationSmoothness}
									range={ADJUSTMENT_RANGES.stabilizationSmoothness}
									onChange={(value) => setValue("stabilizationSmoothness", value)}
								/>
								<div className="flex items-center justify-between gap-2">
									<div className="flex min-w-0 items-center gap-1.5">
										<HugeiconsIcon icon={CropIcon} className="text-muted-foreground size-3.5 shrink-0" />
										<span className="text-foreground truncate text-xs font-medium">
											Crop automático
										</span>
									</div>
									<Switch
										checked={values.stabilizationAutoCrop}
										onCheckedChange={setAutoCrop}
									/>
								</div>
							</SectionFields>
						</SectionContent>
					</Section>
				</TabsContent>

				<TabsContent value="advanced" className="min-h-0 flex-1 overflow-y-auto px-0!">
					<AvancadoTab />
				</TabsContent>
				<TabsContent value="hsl" className="min-h-0 flex-1 overflow-y-auto px-0!">
					<HslTab />
				</TabsContent>
				<TabsContent value="curves" className="min-h-0 flex-1 overflow-y-auto px-0!">
					<CurvasTab />
				</TabsContent>
				<TabsContent value="lut" className="min-h-0 flex-1 overflow-y-auto px-0!">
					<LutTab />
				</TabsContent>
			</Tabs>
		</div>
	);
}
