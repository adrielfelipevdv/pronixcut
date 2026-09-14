"use client";

import { useState } from "react";
import { toast } from "sonner";
import {
	Section,
	SectionContent,
	SectionHeader,
	SectionTitle,
} from "@/components/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { cn } from "@/utils/ui";
import { useEditor } from "@/editor/use-editor";
import {
	AddTrackCommand,
	BatchCommand,
	InsertElementCommand,
	UpsertKeyframeCommand,
} from "@/commands";
import { buildSubtitleTextElement } from "@/subtitles/build-subtitle-text-element";
import { mediaTime, mediaTimeFromSeconds, subMediaTime, type MediaTime } from "@/wasm";
import { usePronixEditorStore } from "@/pronix-editor/store";

// Ported from the original PronixEditor's animation/templates.py — same
// four templates, same field lists (translated), same auto/manual split
// (the Resolve-only "zoom via keyframe on the clip" case has no browser
// equivalent for the same reason the original made it a manual walkthrough:
// it needs Fusion-level keyframing, not just a client-side overlay).
type FieldType = "text" | "number" | "select" | "color";
interface TemplateField {
	key: string;
	label: string;
	type: FieldType;
	default: string | number;
	options?: string[];
}
interface Template {
	id: "title" | "lower_third" | "callout" | "zoom";
	name: string;
	mode: "auto" | "manual";
	description: string;
	fields: TemplateField[];
}

const ANIM_OPTIONS = ["fade", "slide_up", "slide_down", "slide_left", "slide_right", "none"];
const ANIM_LABELS: Record<string, string> = {
	fade: "Fade",
	slide_up: "Deslizar de baixo",
	slide_down: "Deslizar de cima",
	slide_left: "Deslizar da esquerda",
	slide_right: "Deslizar da direita",
	none: "Nenhuma",
};
const POSITION_OPTIONS = ["top", "center", "lower-third", "bottom"];
const POSITION_LABELS: Record<string, string> = {
	top: "Topo",
	center: "Centro",
	"lower-third": "Terço inferior",
	bottom: "Rodapé",
};

const TEMPLATES: Template[] = [
	{
		id: "title",
		name: "Título animado",
		mode: "auto",
		description: "Título grande (com subtítulo opcional) que entra e sai animado.",
		fields: [
			{ key: "title", label: "Título", type: "text", default: "Seu título" },
			{ key: "subtitle", label: "Subtítulo (opcional)", type: "text", default: "" },
			{ key: "position", label: "Posição", type: "select", default: "center", options: POSITION_OPTIONS },
			{ key: "color", label: "Cor do texto", type: "color", default: "#FFFFFF" },
			{ key: "anim_in", label: "Entrada", type: "select", default: "slide_up", options: ANIM_OPTIONS },
			{ key: "anim_out", label: "Saída", type: "select", default: "fade", options: ANIM_OPTIONS },
			{ key: "start", label: "Início (s)", type: "number", default: 0 },
			{ key: "duration", label: "Duração (s)", type: "number", default: 3 },
		],
	},
	{
		id: "lower_third",
		name: "Lower third (nome + cargo)",
		mode: "auto",
		description: "Tarja inferior com nome e cargo, e uma barra de destaque.",
		fields: [
			{ key: "name", label: "Nome", type: "text", default: "Nome Sobrenome" },
			{ key: "role", label: "Cargo / descrição", type: "text", default: "Cargo" },
			{ key: "accent_color", label: "Cor da barra/fundo", type: "color", default: "#FF6A00" },
			{ key: "color", label: "Cor do texto", type: "color", default: "#FFFFFF" },
			{ key: "anim_in", label: "Entrada", type: "select", default: "slide_left", options: ANIM_OPTIONS },
			{ key: "anim_out", label: "Saída", type: "select", default: "slide_left", options: ANIM_OPTIONS },
			{ key: "start", label: "Início (s)", type: "number", default: 0 },
			{ key: "duration", label: "Duração (s)", type: "number", default: 4 },
		],
	},
	{
		id: "callout",
		name: "Destaque (callout)",
		mode: "auto",
		description: "Frase em destaque dentro de uma caixa colorida.",
		fields: [
			{ key: "text", label: "Texto", type: "text", default: "Destaque" },
			{ key: "box_color", label: "Cor da caixa", type: "color", default: "#FF6A00" },
			{ key: "color", label: "Cor do texto", type: "color", default: "#FFFFFF" },
			{ key: "position", label: "Posição", type: "select", default: "center", options: POSITION_OPTIONS },
			{ key: "anim_in", label: "Entrada", type: "select", default: "fade", options: ANIM_OPTIONS },
			{ key: "anim_out", label: "Saída", type: "select", default: "fade", options: ANIM_OPTIONS },
			{ key: "start", label: "Início (s)", type: "number", default: 0 },
			{ key: "duration", label: "Duração (s)", type: "number", default: 2.5 },
		],
	},
	{
		id: "zoom",
		name: "Zoom / Punch-in (manual)",
		mode: "manual",
		description:
			"Zoom com keyframe no clipe. Isso exige uma engine de composição com keyframes de transform por clipe — aqui vai um passo a passo em vez de aplicar sozinho.",
		fields: [{ key: "amount", label: "Zoom (%)", type: "number", default: 110 }],
	},
];

function defaultsOf(template: Template): Record<string, string> {
	const values: Record<string, string> = {};
	for (const field of template.fields) values[field.key] = String(field.default);
	return values;
}

function verticalAlignFor(position: string): "top" | "middle" | "bottom" {
	if (position === "top") return "top";
	if (position === "center") return "middle";
	return "bottom";
}

export function SmartAnimationTab() {
	const editor = useEditor();
	const { logEvent } = usePronixEditorStore();
	const [selectedId, setSelectedId] = useState<Template["id"]>("title");
	const [params, setParams] = useState<Record<string, string>>(defaultsOf(TEMPLATES[0]));
	const [isApplying, setIsApplying] = useState(false);

	const current = TEMPLATES.find((t) => t.id === selectedId) ?? TEMPLATES[0];

	const pick = (template: Template) => {
		setSelectedId(template.id);
		setParams(defaultsOf(template));
	};
	const setField = (key: string, value: string) => setParams((p) => ({ ...p, [key]: value }));

	const applyEntryExit = ({
		trackId,
		elementId,
		duration,
		animIn,
		animOut,
	}: {
		trackId: string;
		elementId: string;
		duration: MediaTime;
		animIn: string;
		animOut: string;
	}) => {
		const zero = mediaTime({ ticks: 0 });
		const inDur = mediaTimeFromSeconds({ seconds: 0.5 });
		const outDur = mediaTimeFromSeconds({ seconds: 0.5 });
		const OFFSET = 80;

		const kf = (propertyPath: string, time: MediaTime, value: number) =>
			new UpsertKeyframeCommand({ trackId, elementId, propertyPath, time, value, interpolation: "linear" });

		const commands = [];
		const inEnd = duration < inDur ? duration : inDur;
		switch (animIn) {
			case "fade":
				commands.push(kf("opacity", zero, 0), kf("opacity", inEnd, 1));
				break;
			case "slide_up":
				commands.push(kf("transform.positionY", zero, OFFSET), kf("transform.positionY", inEnd, 0));
				break;
			case "slide_down":
				commands.push(kf("transform.positionY", zero, -OFFSET), kf("transform.positionY", inEnd, 0));
				break;
			case "slide_left":
				commands.push(kf("transform.positionX", zero, OFFSET), kf("transform.positionX", inEnd, 0));
				break;
			case "slide_right":
				commands.push(kf("transform.positionX", zero, -OFFSET), kf("transform.positionX", inEnd, 0));
				break;
			default:
				break;
		}

		const outStart = duration < outDur ? zero : subMediaTime({ a: duration, b: outDur });
		switch (animOut) {
			case "fade":
				commands.push(kf("opacity", outStart, 1), kf("opacity", duration, 0));
				break;
			case "slide_up":
				commands.push(kf("transform.positionY", outStart, 0), kf("transform.positionY", duration, -OFFSET));
				break;
			case "slide_down":
				commands.push(kf("transform.positionY", outStart, 0), kf("transform.positionY", duration, OFFSET));
				break;
			case "slide_left":
				commands.push(kf("transform.positionX", outStart, 0), kf("transform.positionX", duration, -OFFSET));
				break;
			case "slide_right":
				commands.push(kf("transform.positionX", outStart, 0), kf("transform.positionX", duration, OFFSET));
				break;
			default:
				break;
		}

		if (commands.length > 0) {
			editor.command.execute({ command: new BatchCommand(commands) });
		}
	};

	const applyAuto = () => {
		const canvasSize = editor.project.getActive().settings.canvasSize;
		const durationSeconds = Math.max(0.4, Number(params.duration) || 3);

		let content = "";
		let color = params.color ?? "#FFFFFF";
		let position = params.position ?? "center";
		let background: { enabled: boolean; color: string } | undefined;

		if (current.id === "title") {
			content = params.subtitle?.trim()
				? `${params.title || "Título"}\n${params.subtitle}`
				: params.title || "Título";
		} else if (current.id === "lower_third") {
			content = params.role?.trim() ? `${params.name || "Nome"}\n${params.role}` : params.name || "Nome";
			position = "lower-third";
			background = { enabled: true, color: params.accent_color ?? "#FF6A00" };
		} else if (current.id === "callout") {
			content = params.text || "Destaque";
			background = { enabled: true, color: params.box_color ?? "#FF6A00" };
		}

		const addTrackCommand = new AddTrackCommand({ type: "text", index: 0 });
		const trackId = addTrackCommand.getTrackId();
		const element = buildSubtitleTextElement({
			index: 0,
			caption: {
				text: content,
				startTime: Number(params.start) || 0,
				duration: durationSeconds,
				style: {
					color,
					placement: { verticalAlign: verticalAlignFor(position) },
				},
			},
			canvasSize,
		});
		element.params = {
			...element.params,
			color,
			fontSize: current.id === "title" ? 8 : 5,
			...(background
				? {
						"background.enabled": true,
						"background.color": background.color,
						"background.paddingX": 24,
						"background.paddingY": 16,
						"background.cornerRadius": 8,
					}
				: {}),
		};

		const insertCommand = new InsertElementCommand({
			placement: { mode: "explicit", trackId },
			element,
		});

		const elementId = insertCommand.getElementId();

		editor.command.execute({
			command: new BatchCommand([addTrackCommand, insertCommand]),
		});

		if (elementId) {
			applyEntryExit({
				trackId,
				elementId,
				duration: element.duration,
				animIn: params.anim_in ?? "fade",
				animOut: params.anim_out ?? "fade",
			});
		}

		toast.success(`"${current.name}" aplicado numa trilha nova`);
		logEvent({ type: "smart-animation", detail: `Aplicou o template "${current.name}"` });
	};

	const handleApply = () => {
		setIsApplying(true);
		try {
			if (current.mode === "manual") return;
			applyAuto();
		} catch (error) {
			toast.error("Falha ao aplicar animação", {
				description: error instanceof Error ? error.message : undefined,
			});
		} finally {
			setIsApplying(false);
		}
	};

	const zoomAmount = Math.round(Number(params.amount) || 110);
	const zoomInstructions = [
		"Selecione o clipe na timeline onde quer o zoom.",
		"Abra o painel de propriedades do elemento e localize as propriedades de Escala.",
		"Posicione o playhead no INÍCIO do zoom e crie um keyframe de Escala = 100%.",
		`Mova o playhead para o FIM do zoom e ajuste Escala = ${zoomAmount}% (cria o 2º keyframe).`,
		"Opcional: ajuste a curva do keyframe para suavizar (ease in/out) no editor de curvas.",
	];

	return (
		<div className="flex flex-col">
			<Section showTopBorder={false}>
				<SectionHeader>
					<SectionTitle className="flex-1">Tipo de animação</SectionTitle>
				</SectionHeader>
				<SectionContent className="flex flex-wrap gap-1.5 px-2 pb-3">
					{TEMPLATES.map((template) => (
						<button
							key={template.id}
							type="button"
							onClick={() => pick(template)}
							className={cn(
								"rounded-full border px-3 py-1 text-xs",
								selectedId === template.id
									? "bg-secondary text-secondary-foreground border-secondary-border"
									: "border-border text-muted-foreground hover:bg-accent",
							)}
						>
							{template.name}
							{template.mode === "manual" ? " · manual" : ""}
						</button>
					))}
				</SectionContent>
			</Section>

			<Section showTopBorder={false}>
				<SectionContent className="flex flex-col gap-2 px-2 pb-3">
					<p className="text-muted-foreground text-xs">{current.description}</p>
					{current.mode === "auto" && (
						<p className="text-muted-foreground text-xs">
							A animação entra numa <span className="text-foreground">trilha nova</span>,
							sem afetar seus cortes existentes.
						</p>
					)}
					<div className="grid grid-cols-2 gap-2">
						{current.fields.map((field) => (
							<div
								key={field.key}
								className={cn("flex flex-col gap-1", field.type === "text" && "col-span-2")}
							>
								<Label className="text-xs">{field.label}</Label>
								{field.type === "select" ? (
									<Select value={params[field.key]} onValueChange={(v) => setField(field.key, v)}>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{(field.options ?? []).map((option) => (
												<SelectItem key={option} value={option}>
													{ANIM_LABELS[option] ?? POSITION_LABELS[option] ?? option}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								) : field.type === "color" ? (
									<input
										type="color"
										value={params[field.key] || "#ffffff"}
										onChange={(event) => setField(field.key, event.target.value)}
										className="h-9 w-full rounded-md"
									/>
								) : (
									<Input
										type={field.type === "number" ? "number" : "text"}
										value={params[field.key] ?? ""}
										onChange={(event) => setField(field.key, event.target.value)}
									/>
								)}
							</div>
						))}
					</div>

					<Button onClick={handleApply} disabled={isApplying} className="w-full">
						{current.mode === "manual" ? "Ver passo a passo" : "Aplicar no projeto"}
					</Button>

					{current.mode === "manual" && (
						<ol className="list-decimal space-y-1 pl-4 text-xs">
							{zoomInstructions.map((step) => (
								<li key={step}>{step}</li>
							))}
						</ol>
					)}
				</SectionContent>
			</Section>
		</div>
	);
}
