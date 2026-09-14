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
import { Spinner } from "@/components/ui/spinner";
import { useEditor } from "@/editor/use-editor";
import { hasMediaId } from "@/timeline/element-utils";
import { detectSilenceForElement, SilenceCutCommand } from "@/pronix-editor/silence-cut";
import { usePronixEditorStore } from "@/pronix-editor/store";
import type { TimelineElement } from "@/timeline/types";
import { processMediaAssets } from "@/media/processing";
import { AddMediaAssetCommand } from "@/commands/media";

/**
 * Auto-Edit — the original PronixEditor's flagship tab: detect the active
 * clip, transcribe it, cut silences, apply Voice Isolation, generate
 * captions, and reformat the aspect ratio, all in one pass.
 *
 * In this port:
 * - Silence cut: real, below (src/pronix-editor/silence-cut.ts).
 * - Transcription + captions: PronixCut already had a real, working
 *   Whisper-based auto-caption feature (Legendas, in the main sidebar) —
 *   not duplicated here, linked instead.
 * - Voice Isolation: the original's "native" mode calls a DaVinci Resolve
 *   Fairlight preset unreachable outside Resolve. Its "Voz limpa" fallback
 *   (ffmpeg highpass+denoise+compress+loudnorm, from audio/clean.py) is
 *   ported as-is below, via /api/pronix-editor/clean-voice.
 * - Aspect ratio/format: PronixCut already exposes this in Configurações
 *   → Proporção — not duplicated here.
 */
export function AutoEditTab() {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActiveOrNull());
	const selectedElements = useEditor((e) => e.selection.getSelectedElements());
	const sceneTracks = useEditor((e) => e.scenes.getActiveScene().tracks);
	const mediaAssets = useEditor((e) => e.media.getAssets());
	const { logEvent } = usePronixEditorStore();

	const [silenceThresholdDb, setSilenceThresholdDb] = useState(-30);
	const [silenceMinMs, setSilenceMinMs] = useState(700);
	const [silencePaddingMs, setSilencePaddingMs] = useState(100);
	const [isCuttingSilence, setIsCuttingSilence] = useState(false);
	const [isCleaningVoice, setIsCleaningVoice] = useState(false);

	const selectedAudibleTarget = (() => {
		const ref = selectedElements[0];
		if (!ref) return null;
		const allTracks = [sceneTracks.main, ...sceneTracks.audio, ...sceneTracks.overlay];
		const track = allTracks.find((t) => t.id === ref.trackId);
		const element = track?.elements.find((el) => el.id === ref.elementId) as
			| TimelineElement
			| undefined;
		if (!element || !hasMediaId(element)) return null;
		if (element.type !== "video" && element.type !== "audio") return null;
		const mediaAsset = mediaAssets.find((asset) => asset.id === element.mediaId);
		if (!mediaAsset) return null;
		return { element, mediaAsset };
	})();

	const handleSilenceCut = async () => {
		if (!selectedAudibleTarget) return;
		setIsCuttingSilence(true);
		try {
			const ranges = await detectSilenceForElement({
				mediaAsset: selectedAudibleTarget.mediaAsset,
				element: selectedAudibleTarget.element,
				options: {
					thresholdDb: silenceThresholdDb,
					minSilenceSeconds: silenceMinMs / 1000,
					paddingSeconds: silencePaddingMs / 1000,
				},
			});

			if (ranges.length === 0) {
				toast.info("Nenhum silêncio encontrado com esses parâmetros");
				return;
			}

			const command = new SilenceCutCommand(ranges);
			editor.command.execute({ command });
			toast.success(`${command.getCutCount()} trecho(s) de silêncio removido(s)`);
			logEvent({
				type: "silence-cut",
				detail: `Removeu ${command.getCutCount()} trecho(s) de silêncio de "${selectedAudibleTarget.element.name}"`,
			});
		} catch (error) {
			toast.error("Falha ao cortar silêncio", {
				description: error instanceof Error ? error.message : undefined,
			});
		} finally {
			setIsCuttingSilence(false);
		}
	};

	const handleCleanVoice = async () => {
		if (!selectedAudibleTarget || !activeProject) return;
		setIsCleaningVoice(true);
		try {
			const formData = new FormData();
			formData.append("file", selectedAudibleTarget.mediaAsset.file, selectedAudibleTarget.mediaAsset.name);

			const response = await fetch("/api/pronix-editor/clean-voice", {
				method: "POST",
				body: formData,
			});

			if (!response.ok) {
				const data = await response.json().catch(() => null);
				throw new Error(data?.error ?? "Falha na limpeza de áudio.");
			}

			const blob = await response.blob();
			const file = new File([blob], `Voz limpa - ${selectedAudibleTarget.element.name}.wav`, {
				type: "audio/wav",
			});
			const [processedAsset] = await processMediaAssets({ files: [file] });
			if (!processedAsset) throw new Error("Falha ao processar o áudio limpo.");

			editor.command.execute({
				command: new AddMediaAssetCommand({
					projectId: activeProject.metadata.id,
					asset: processedAsset,
				}),
			});
			toast.success("Áudio limpo adicionado à biblioteca");
			logEvent({
				type: "clean-voice",
				detail: `Gerou áudio limpo de "${selectedAudibleTarget.element.name}"`,
			});
		} catch (error) {
			toast.error("Falha ao limpar a voz", {
				description: error instanceof Error ? error.message : undefined,
			});
		} finally {
			setIsCleaningVoice(false);
		}
	};

	return (
		<div className="flex flex-col">
			<Section showTopBorder={false}>
				<SectionHeader>
					<SectionTitle className="flex-1">Corte de silêncio</SectionTitle>
				</SectionHeader>
				<SectionContent className="flex flex-col gap-2 px-2 pb-3">
					{selectedAudibleTarget ? (
						<p className="text-muted-foreground text-xs">
							Clipe selecionado:{" "}
							<span className="text-foreground">{selectedAudibleTarget.element.name}</span>
						</p>
					) : (
						<p className="text-muted-foreground text-xs">
							Selecione um clipe de vídeo ou áudio na timeline para analisar.
						</p>
					)}
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="silence-threshold" className="text-sm">
							Limiar de silêncio (dB)
						</Label>
						<Input
							id="silence-threshold"
							type="number"
							value={silenceThresholdDb}
							onChange={(event) => setSilenceThresholdDb(Number(event.target.value) || 0)}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="silence-min" className="text-sm">
							Duração mínima do silêncio (ms)
						</Label>
						<Input
							id="silence-min"
							type="number"
							min={0}
							value={silenceMinMs}
							onChange={(event) => setSilenceMinMs(Math.max(0, Number(event.target.value) || 0))}
						/>
					</div>
					<div className="flex flex-col gap-1.5">
						<Label htmlFor="silence-padding" className="text-sm">
							Preenchimento nas bordas (ms)
						</Label>
						<Input
							id="silence-padding"
							type="number"
							min={0}
							value={silencePaddingMs}
							onChange={(event) => setSilencePaddingMs(Math.max(0, Number(event.target.value) || 0))}
						/>
					</div>
					<Button
						onClick={handleSilenceCut}
						disabled={!selectedAudibleTarget || isCuttingSilence}
						className="w-full gap-2"
					>
						{isCuttingSilence ? <Spinner className="size-4" /> : null}
						{isCuttingSilence ? "Analisando áudio..." : "Detectar e cortar silêncio"}
					</Button>
				</SectionContent>
			</Section>

			<Section showTopBorder={false}>
				<SectionHeader>
					<SectionTitle className="flex-1">Legendas e transcrição</SectionTitle>
				</SectionHeader>
				<SectionContent className="px-2 pb-3">
					<p className="text-muted-foreground text-xs">
						A transcrição por IA (Whisper local) e o editor de blocos de legenda já
						existem na aba <span className="text-foreground">Legendas</span> do menu
						principal do editor (ícone de legendas na barra lateral).
					</p>
				</SectionContent>
			</Section>

			<Section showTopBorder={false}>
				<SectionHeader>
					<SectionTitle className="flex-1">Voz limpa</SectionTitle>
				</SectionHeader>
				<SectionContent className="flex flex-col gap-2 px-2 pb-3">
					<p className="text-muted-foreground text-xs">
						O modo nativo "Voice Isolation" do plugin original só existe como preset
						Fairlight do DaVinci Resolve (<code>Timeline.ApplyFairlightPreset</code>),
						chamável apenas de dentro do Resolve — sem equivalente aqui. Este botão
						replica o modo alternativo que o próprio PronixEditor original usa quando
						não está rodando dentro do Resolve: a mesma cadeia de filtros ffmpeg
						(highpass → denoise FFT → compressor → normalização de loudness),
						processada localmente via ffmpeg.
					</p>
					{selectedAudibleTarget ? (
						<p className="text-muted-foreground text-xs">
							Clipe selecionado:{" "}
							<span className="text-foreground">{selectedAudibleTarget.element.name}</span>
						</p>
					) : (
						<p className="text-muted-foreground text-xs">
							Selecione um clipe de vídeo ou áudio na timeline.
						</p>
					)}
					<Button
						onClick={handleCleanVoice}
						disabled={!selectedAudibleTarget || isCleaningVoice}
						className="w-full gap-2"
					>
						{isCleaningVoice ? <Spinner className="size-4" /> : null}
						{isCleaningVoice ? "Limpando áudio..." : "Gerar voz limpa"}
					</Button>
					<p className="text-muted-foreground text-xs">
						Requer o ffmpeg instalado e disponível no PATH do sistema. O resultado é
						adicionado como um novo áudio na biblioteca — arraste-o para a timeline
						para substituir ou sobrepor o áudio original.
					</p>
				</SectionContent>
			</Section>
		</div>
	);
}
