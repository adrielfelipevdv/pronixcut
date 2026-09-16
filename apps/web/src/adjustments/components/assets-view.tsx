"use client";

import {
	Tabs,
	TabsContent,
	TabsList,
	TabsTrigger,
} from "@/components/ui/tabs";
import { AvancadoTab } from "./avancado-tab";
import { HslTab } from "./hsl-tab";
import { CurvasTab } from "./curvas-tab";
import { LutTab } from "./lut-tab";

export function AdjustmentsView() {
	return (
		<div className="flex h-full flex-col">
			<div className="bg-background border-border flex h-11 shrink-0 items-center border-b pr-2 pl-3.5">
				<span className="text-foreground text-[15px] font-semibold">
					Ajustes
				</span>
			</div>

			{/*
			 * The "Básico" sub-tab (Exposição/Contraste/Brilho/Saturação/
			 * Temperatura/Matiz/Vibração/Luz-e-Sombra/Nitidez/Redução de
			 * ruído/Vinheta/Estabilização) is intentionally NOT shown here.
			 * It was built against `useAdjustmentsStore` — pure local UI
			 * state with zero consumers anywhere in the render/effects
			 * pipeline (confirmed live: dragging its sliders never changed
			 * a single rendered pixel in Preview or Export). Its own
			 * original source comment said as much ("Not yet wired into the
			 * render pipeline... a future pass can connect these values").
			 * Wiring it for real would mean building an entire parallel
			 * color-grading engine (plus actual video stabilization, which
			 * doesn't exist anywhere in this codebase) — not a "simple fix"
			 * for a pre-launch bug pass. Rather than ship sliders that look
			 * functional but silently do nothing, this tab is hidden until
			 * a real implementation lands. "Avançado" already covers the
			 * real, working equivalent of most of the same controls
			 * (Realces/Sombras/Brancos/Pretos/Nitidez/Clareza/Redução de
			 * ruído/Vinheta) through the real color-grade engine.
			 */}
			<Tabs defaultValue="advanced" variant="underline" className="flex min-h-0 flex-1 flex-col">
				<TabsList aria-label="Modo de ajuste" className="shrink-0">
					<TabsTrigger value="advanced">Avançado</TabsTrigger>
					<TabsTrigger value="hsl">HSL</TabsTrigger>
					<TabsTrigger value="curves">Curvas</TabsTrigger>
					<TabsTrigger value="lut">LUT</TabsTrigger>
				</TabsList>

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
