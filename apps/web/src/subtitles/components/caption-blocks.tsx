"use client";

import { useMemo, useState } from "react";
import { toast } from "sonner";
import { useEditor } from "@/editor/use-editor";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Spinner } from "@/components/ui/spinner";
import { Section, SectionContent, SectionHeader, SectionTitle } from "@/components/section";
import {
	UpdateElementsCommand,
	DeleteElementsCommand,
	SplitElementsCommand,
	InsertElementCommand,
} from "@/commands";
import { BatchCommand } from "@/commands";
import {
	addMediaTime,
	mediaTime,
	mediaTimeFromSeconds,
	mediaTimeToSeconds,
	subMediaTime,
} from "@/wasm";
import { buildSubtitleTextElement } from "@/subtitles/build-subtitle-text-element";
import type { TextElement } from "@/timeline/types";
import { usePronixEditorStore } from "@/pronix-editor/store";
import { HugeiconsIcon } from "@hugeicons/react";
import { SparklesIcon } from "@hugeicons/core-free-icons";

const NUDGE_SECONDS = 0.05;

interface CaptionBlock {
	trackId: string;
	element: TextElement;
}

function formatTime(seconds: number): string {
	return seconds.toFixed(2) + "s";
}

function getContent(element: TextElement): string {
	return String(element.params.content ?? "");
}

export function CaptionBlockEditor() {
	const editor = useEditor();
	const tracks = useEditor((e) => e.scenes.getActiveScene().tracks);
	const { integrations, provider, logEvent } = usePronixEditorStore();
	const [isRewriting, setIsRewriting] = useState(false);

	const blocks: CaptionBlock[] = useMemo(() => {
		const result: CaptionBlock[] = [];
		for (const track of tracks.overlay) {
			if (track.type !== "text") continue;
			for (const element of track.elements) {
				if (element.type === "text") {
					result.push({ trackId: track.id, element });
				}
			}
		}
		return result.sort((a, b) => a.element.startTime - b.element.startTime);
	}, [tracks]);

	if (blocks.length === 0) {
		return null;
	}

	const updateContent = ({ block, content }: { block: CaptionBlock; content: string }) => {
		editor.command.execute({
			command: new UpdateElementsCommand({
				updates: [
					{
						trackId: block.trackId,
						elementId: block.element.id,
						patch: { params: { content } },
					},
				],
			}),
		});
	};

	const nudgeStart = ({ block, deltaSeconds }: { block: CaptionBlock; deltaSeconds: number }) => {
		const delta = mediaTimeFromSeconds({ seconds: deltaSeconds });
		const newStart = addMediaTime({ a: block.element.startTime, b: delta });
		const newDuration = subMediaTime({ a: block.element.duration, b: delta });
		if (newDuration <= 0) return;
		editor.command.execute({
			command: new UpdateElementsCommand({
				updates: [
					{
						trackId: block.trackId,
						elementId: block.element.id,
						patch: { startTime: newStart, duration: newDuration },
					},
				],
			}),
		});
	};

	const nudgeEnd = ({ block, deltaSeconds }: { block: CaptionBlock; deltaSeconds: number }) => {
		const delta = mediaTimeFromSeconds({ seconds: deltaSeconds });
		const newDuration = addMediaTime({ a: block.element.duration, b: delta });
		if (newDuration <= 0) return;
		editor.command.execute({
			command: new UpdateElementsCommand({
				updates: [
					{ trackId: block.trackId, elementId: block.element.id, patch: { duration: newDuration } },
				],
			}),
		});
	};

	const splitBlock = ({ block }: { block: CaptionBlock }) => {
		const midTime = addMediaTime({
			a: block.element.startTime,
			b: mediaTime({ ticks: Math.round(block.element.duration / 2) }),
		});
		const splitCmd = new SplitElementsCommand({
			elements: [{ trackId: block.trackId, elementId: block.element.id }],
			splitTime: midTime,
		});
		editor.command.execute({ command: splitCmd });
		const rightSide = splitCmd.getRightSideElements()[0];
		if (!rightSide) return;

		const content = getContent(block.element);
		const words = content.split(/\s+/).filter(Boolean);
		const half = Math.ceil(words.length / 2);
		const leftText = words.slice(0, half).join(" ");
		const rightText = words.slice(half).join(" ");

		editor.command.execute({
			command: new BatchCommand([
				new UpdateElementsCommand({
					updates: [
						{
							trackId: block.trackId,
							elementId: block.element.id,
							patch: { params: { content: leftText || content } },
						},
					],
				}),
				new UpdateElementsCommand({
					updates: [
						{
							trackId: rightSide.trackId,
							elementId: rightSide.elementId,
							patch: { params: { content: rightText || content } },
						},
					],
				}),
			]),
		});
	};

	const mergeWithNext = ({ block, index }: { block: CaptionBlock; index: number }) => {
		const next = blocks[index + 1];
		if (!next) return;

		const newDuration = subMediaTime({
			a: addMediaTime({ a: next.element.startTime, b: next.element.duration }),
			b: block.element.startTime,
		});
		const mergedContent = `${getContent(block.element)} ${getContent(next.element)}`.trim();

		editor.command.execute({
			command: new BatchCommand([
				new UpdateElementsCommand({
					updates: [
						{
							trackId: block.trackId,
							elementId: block.element.id,
							patch: { duration: newDuration, params: { content: mergedContent } },
						},
					],
				}),
				new DeleteElementsCommand({
					elements: [{ trackId: next.trackId, elementId: next.element.id }],
				}),
			]),
		});
	};

	const deleteBlock = ({ block }: { block: CaptionBlock }) => {
		editor.command.execute({
			command: new DeleteElementsCommand({
				elements: [{ trackId: block.trackId, elementId: block.element.id }],
			}),
		});
	};

	const addBlockAfter = ({ block }: { block: CaptionBlock }) => {
		const canvasSize = editor.project.getActive().settings.canvasSize;
		const startTime = addMediaTime({ a: block.element.startTime, b: block.element.duration });
		const newElement = buildSubtitleTextElement({
			index: blocks.length,
			caption: {
				text: "Novo bloco",
				startTime: mediaTimeToSeconds({ time: startTime }),
				duration: 1,
			},
			canvasSize,
		});

		editor.command.execute({
			command: new InsertElementCommand({
				placement: { mode: "explicit", trackId: block.trackId },
				element: newElement,
			}),
		});
	};

	const handleFixWithAi = async () => {
		const enabledTextProviders = (["openai", "gemini", "anthropic"] as const).filter(
			(key) => integrations[key].enabled && integrations[key].apiKey.trim(),
		);
		const aiProvider = enabledTextProviders.includes(provider as "openai" | "gemini")
			? provider
			: enabledTextProviders[0];

		if (!aiProvider) {
			toast.error("Configure uma chave de API de IA com texto habilitada", {
				description: "OpenAI, Gemini ou Anthropic, em Configurações → Integrações.",
			});
			return;
		}

		setIsRewriting(true);
		try {
			const response = await fetch("/api/pronix-editor/rewrite-captions", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					provider: aiProvider,
					apiKey: integrations[aiProvider].apiKey,
					texts: blocks.map((block) => getContent(block.element)),
				}),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error ?? "Falha ao corrigir legendas.");

			const texts = data.texts as string[];
			if (texts.length !== blocks.length) {
				throw new Error("A IA retornou uma quantidade de blocos diferente da esperada.");
			}

			editor.command.execute({
				command: new BatchCommand(
					blocks.map(
						(block, i) =>
							new UpdateElementsCommand({
								updates: [
									{
										trackId: block.trackId,
										elementId: block.element.id,
										patch: { params: { content: texts[i] } },
									},
								],
							}),
					),
				),
			});
			toast.success("Legendas corrigidas com IA");
			logEvent({ type: "caption-ai-fix", provider: aiProvider, detail: `Corrigiu ${texts.length} bloco(s)` });
		} catch (error) {
			toast.error("Falha ao corrigir com IA", {
				description: error instanceof Error ? error.message : undefined,
			});
		} finally {
			setIsRewriting(false);
		}
	};

	return (
		<Section collapsible defaultOpen sectionKey="captions:blocks">
			<SectionHeader
				actions={
					// `actions` renders as a sibling of the collapsible header's own
					// clickable button (see SectionHeader), not nested inside it —
					// putting this button in `children` instead put a <button> inside
					// that outer collapse-toggle <button>, which is invalid HTML and
					// was the actual cause of the header's broken/overlapping layout,
					// not a font-size or spacing issue.
					<Button
						variant="outline"
						size="sm"
						className="shrink-0"
						onClick={handleFixWithAi}
						disabled={isRewriting}
					>
						{isRewriting ? (
							<Spinner className="size-3.5" />
						) : (
							<HugeiconsIcon icon={SparklesIcon} className="size-3.5" />
						)}
						Corrigir com IA
					</Button>
				}
			>
				<SectionTitle className="truncate">
					Blocos de legenda ({blocks.length})
				</SectionTitle>
			</SectionHeader>
			<SectionContent className="flex flex-col gap-2 px-2 pb-3">
				{blocks.map((block, index) => (
					<div
						key={block.element.id}
						className="border-border flex flex-col gap-1.5 rounded-md border p-2"
					>
						<Textarea
							value={getContent(block.element)}
							onChange={(event) => updateContent({ block, content: event.target.value })}
							className="min-h-12 resize-none text-sm"
						/>
						<span className="text-muted-foreground text-xs">
							{formatTime(mediaTimeToSeconds({ time: block.element.startTime }))} –{" "}
							{formatTime(
								mediaTimeToSeconds({
									time: addMediaTime({ a: block.element.startTime, b: block.element.duration }),
								}),
							)}
						</span>
						{/* 2-column grid (Início/Fim × −/+) instead of one flex-wrap row —
						    four buttons wrapping unpredictably at narrow panel widths is
						    exactly what read as "comprimido" before. */}
						<div className="grid grid-cols-2 gap-1 text-xs">
							<Button
								variant="ghost"
								size="sm"
								className="h-6 min-w-0 px-1.5"
								onClick={() => nudgeStart({ block, deltaSeconds: -NUDGE_SECONDS })}
							>
								Início −
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="h-6 min-w-0 px-1.5"
								onClick={() => nudgeStart({ block, deltaSeconds: NUDGE_SECONDS })}
							>
								Início +
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="h-6 min-w-0 px-1.5"
								onClick={() => nudgeEnd({ block, deltaSeconds: -NUDGE_SECONDS })}
							>
								Fim −
							</Button>
							<Button
								variant="ghost"
								size="sm"
								className="h-6 min-w-0 px-1.5"
								onClick={() => nudgeEnd({ block, deltaSeconds: NUDGE_SECONDS })}
							>
								Fim +
							</Button>
						</div>
						<div className="flex flex-wrap items-center gap-1">
							<Button variant="outline" size="sm" className="h-6 px-1.5 text-xs" onClick={() => splitBlock({ block })}>
								Dividir
							</Button>
							{index < blocks.length - 1 && (
								<Button
									variant="outline"
									size="sm"
									className="h-6 px-1.5 text-xs"
									onClick={() => mergeWithNext({ block, index })}
								>
									Juntar com o próximo
								</Button>
							)}
							<Button variant="outline" size="sm" className="h-6 px-1.5 text-xs" onClick={() => addBlockAfter({ block })}>
								+ Bloco
							</Button>
							<Button
								variant="destructive-foreground"
								size="sm"
								className="h-6 px-1.5 text-xs"
								onClick={() => deleteBlock({ block })}
							>
								Excluir
							</Button>
						</div>
					</div>
				))}
			</SectionContent>
		</Section>
	);
}
