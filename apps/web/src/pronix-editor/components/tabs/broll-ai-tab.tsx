"use client";

import { useRef, useState } from "react";
import { toast } from "sonner";
import {
	Section,
	SectionContent,
	SectionHeader,
	SectionTitle,
} from "@/components/section";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Input } from "@/components/ui/input";
import { FolderPlus, ExternalLink } from "lucide-react";
import { useEditor } from "@/editor/use-editor";
import { processMediaAssets } from "@/media/processing";
import { AddMediaAssetCommand } from "@/commands/media";
import { usePronixEditorStore } from "@/pronix-editor/store";

interface GeneratedClip {
	id: string;
	prompt: string;
	dataUrl: string;
	mimeType: string;
}

interface TikTokResult {
	id: string;
	link: string;
	thumbnail: string | null;
	videoUrl: string | null;
	desc: string;
	author: string;
	plays: number;
	likes: number;
}

function dataUrlToFile({
	dataUrl,
	mimeType,
	filename,
}: {
	dataUrl: string;
	mimeType: string;
	filename: string;
}): File {
	const base64 = dataUrl.split(",")[1] ?? "";
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);
	return new File([bytes], filename, { type: mimeType });
}

const POLL_INTERVAL_MS = 5000;
const POLL_TIMEOUT_MS = 6 * 60 * 1000;

export function BRollAiTab() {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActiveOrNull());
	const { integrations, logEvent } = usePronixEditorStore();
	const [prompt, setPrompt] = useState("");
	const [aspectRatio, setAspectRatio] = useState<"16:9" | "9:16">("16:9");
	const [isGenerating, setIsGenerating] = useState(false);
	const [statusText, setStatusText] = useState("");
	const [clips, setClips] = useState<GeneratedClip[]>([]);
	const cancelRef = useRef(false);

	const [tiktokQuery, setTiktokQuery] = useState("");
	const [tiktokResults, setTiktokResults] = useState<TikTokResult[]>([]);
	const [isSearchingTikTok, setIsSearchingTikTok] = useState(false);
	const [isImportingId, setIsImportingId] = useState<string | null>(null);

	const geminiKey = integrations.gemini.apiKey;
	const geminiEnabled = integrations.gemini.enabled && geminiKey.trim().length > 0;
	const tiktokKey = integrations.tiktokSearch.apiKey;
	const tiktokEnabled = integrations.tiktokSearch.enabled && tiktokKey.trim().length > 0;

	const pollUntilDone = async (operationName: string): Promise<{ dataUrl: string; mimeType: string }> => {
		const start = Date.now();
		while (!cancelRef.current) {
			if (Date.now() - start > POLL_TIMEOUT_MS) {
				throw new Error("Tempo limite esperando a geração do vídeo.");
			}
			await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
			setStatusText("Gerando vídeo com IA (pode levar alguns minutos)...");
			const response = await fetch("/api/pronix-editor/video-status", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ apiKey: geminiKey, operationName }),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error ?? "Falha ao consultar a geração.");
			if (data.done) return { dataUrl: data.dataUrl, mimeType: data.mimeType };
		}
		throw new Error("Geração cancelada.");
	};

	const handleGenerate = async () => {
		if (!prompt.trim()) {
			toast.error("Descreva o B-roll que você quer gerar");
			return;
		}
		if (!geminiEnabled) {
			toast.error("Configure e ative sua chave do Gemini em Integrações para gerar vídeo com IA");
			return;
		}

		cancelRef.current = false;
		setIsGenerating(true);
		setStatusText("Iniciando geração...");
		try {
			const startResponse = await fetch("/api/pronix-editor/generate-video", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ apiKey: geminiKey, prompt, aspectRatio }),
			});
			const startData = await startResponse.json();
			if (!startResponse.ok) throw new Error(startData.error ?? "Falha ao iniciar a geração.");

			const { dataUrl, mimeType } = await pollUntilDone(startData.operationName);
			setClips((prev) => [{ id: crypto.randomUUID(), prompt, dataUrl, mimeType }, ...prev]);
			toast.success("Clipe de B-roll gerado");
			logEvent({ type: "broll-generate", provider: "gemini", detail: `Gerou B-roll: "${prompt.slice(0, 60)}"` });
		} catch (error) {
			toast.error("Falha ao gerar vídeo", {
				description: error instanceof Error ? error.message : undefined,
			});
		} finally {
			setIsGenerating(false);
			setStatusText("");
		}
	};

	const handleAddToLibrary = async (clip: GeneratedClip) => {
		if (!activeProject) {
			toast.error("Abra um projeto antes de importar");
			return;
		}
		try {
			const file = dataUrlToFile({
				dataUrl: clip.dataUrl,
				mimeType: clip.mimeType,
				filename: `broll-${clip.id}.mp4`,
			});
			const [processedAsset] = await processMediaAssets({ files: [file] });
			if (!processedAsset) throw new Error("Falha ao processar o vídeo gerado.");

			editor.command.execute({
				command: new AddMediaAssetCommand({
					projectId: activeProject.metadata.id,
					asset: processedAsset,
				}),
			});
			toast.success("Adicionado à biblioteca");
		} catch (error) {
			toast.error("Falha ao adicionar à biblioteca", {
				description: error instanceof Error ? error.message : undefined,
			});
		}
	};

	const handleTikTokSearch = async () => {
		if (!tiktokQuery.trim()) {
			toast.error("Digite uma palavra-chave para buscar");
			return;
		}
		if (!tiktokEnabled) {
			toast.error("Configure e ative sua chave da busca TikTok em Integrações");
			return;
		}
		setIsSearchingTikTok(true);
		try {
			const response = await fetch("/api/pronix-editor/tiktok-search", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ apiKey: tiktokKey, query: tiktokQuery, count: 20 }),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error ?? "Falha na busca.");
			setTiktokResults(data.results ?? []);
			logEvent({
				type: "tiktok-search",
				provider: "tiktokSearch",
				detail: `Buscou referências no TikTok: "${tiktokQuery}" (${data.results?.length ?? 0} resultados)`,
			});
			if ((data.results ?? []).length === 0) {
				toast.info("Nenhum resultado encontrado para essa busca");
			}
		} catch (error) {
			toast.error("Falha ao buscar no TikTok", {
				description: error instanceof Error ? error.message : undefined,
			});
		} finally {
			setIsSearchingTikTok(false);
		}
	};

	const handleImportTikTokVideo = async (result: TikTokResult) => {
		if (!result.videoUrl) {
			toast.error("Este resultado não tem um link de vídeo direto");
			return;
		}
		if (!activeProject) {
			toast.error("Abra um projeto antes de importar");
			return;
		}
		setIsImportingId(result.id);
		try {
			const response = await fetch("/api/pronix-editor/download-asset", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url: result.videoUrl }),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error ?? "Falha ao baixar o vídeo.");

			const file = dataUrlToFile({
				dataUrl: data.dataUrl,
				mimeType: data.mimeType,
				filename: `tiktok-${result.id}.mp4`,
			});
			const [processedAsset] = await processMediaAssets({ files: [file] });
			if (!processedAsset) throw new Error("Falha ao processar o vídeo baixado.");

			editor.command.execute({
				command: new AddMediaAssetCommand({
					projectId: activeProject.metadata.id,
					asset: processedAsset,
				}),
			});
			toast.success("Referência importada para a biblioteca");
		} catch (error) {
			toast.error("Falha ao importar referência", {
				description: error instanceof Error ? error.message : undefined,
			});
		} finally {
			setIsImportingId(null);
		}
	};

	return (
		<div className="flex flex-col">
			<Section showTopBorder={false}>
				<SectionHeader>
					<SectionTitle className="flex-1">Gerar B-roll com IA (Veo/Gemini)</SectionTitle>
				</SectionHeader>
				<SectionContent className="flex flex-col gap-2 px-2 pb-3">
					<Label className="text-xs">Descreva a cena</Label>
					<Textarea
						value={prompt}
						onChange={(event) => setPrompt(event.target.value)}
						placeholder="Ex: drone sobrevoando uma cidade ao entardecer, cinematográfico"
						rows={3}
					/>
					<div className="flex flex-col gap-1">
						<Label className="text-xs">Proporção</Label>
						<Select value={aspectRatio} onValueChange={(v) => setAspectRatio(v as "16:9" | "9:16")}>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								<SelectItem value="16:9">16:9 (horizontal)</SelectItem>
								<SelectItem value="9:16">9:16 (vertical)</SelectItem>
							</SelectContent>
						</Select>
					</div>
					<Button onClick={handleGenerate} disabled={isGenerating} className="w-full gap-2">
						{isGenerating ? <Spinner className="size-4" /> : null}
						{isGenerating ? statusText || "Gerando..." : "Gerar vídeo"}
					</Button>
					{!geminiEnabled && (
						<p className="text-muted-foreground text-xs">
							Precisa de uma chave do Google Gemini ativa na aba Integrações — a
							geração de vídeo usa o modelo Veo através da mesma chave usada para
							imagens.
						</p>
					)}
				</SectionContent>
			</Section>

			{clips.length > 0 && (
				<Section showTopBorder={false}>
					<SectionHeader>
						<SectionTitle className="flex-1">Clipes gerados</SectionTitle>
					</SectionHeader>
					<SectionContent className="flex flex-col gap-3 px-2 pb-3">
						{clips.map((clip) => (
							<div key={clip.id} className="border-border flex flex-col gap-1.5 rounded-md border p-2">
								<video src={clip.dataUrl} controls className="w-full rounded-md" />
								<p className="text-muted-foreground truncate text-xs">{clip.prompt}</p>
								<Button size="sm" className="gap-2" onClick={() => handleAddToLibrary(clip)}>
									<FolderPlus className="size-4" />
									Adicionar à biblioteca
								</Button>
							</div>
						))}
					</SectionContent>
				</Section>
			)}

			<Section showTopBorder={false}>
				<SectionHeader>
					<SectionTitle className="flex-1">Busca de referências (TikTok)</SectionTitle>
				</SectionHeader>
				<SectionContent className="flex flex-col gap-2 px-2 pb-3">
					<p className="text-muted-foreground text-xs">
						Mesma API usada no plugin original —{" "}
						<span className="text-foreground">tiktokapi.store</span>, um serviço
						pago de terceiro especializado em busca (não é scraping). Devolve até
						20 vídeos por palavra-chave, com link de download sem marca d'água.
					</p>
					<div className="flex gap-1.5">
						<Input
							value={tiktokQuery}
							onChange={(event) => setTiktokQuery(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") handleTikTokSearch();
							}}
							placeholder="Ex: receita rápida, unboxing, treino em casa..."
							className="flex-1"
						/>
						<Button onClick={handleTikTokSearch} disabled={isSearchingTikTok} className="gap-2">
							{isSearchingTikTok ? <Spinner className="size-4" /> : null}
							Buscar
						</Button>
					</div>
					{!tiktokEnabled && (
						<p className="text-muted-foreground text-xs">
							Precisa de uma chave da busca TikTok ativa na aba Integrações
							(tiktokapi.store).
						</p>
					)}
				</SectionContent>
			</Section>

			{tiktokResults.length > 0 && (
				<Section showTopBorder={false}>
					<SectionHeader>
						<SectionTitle className="flex-1">Resultados ({tiktokResults.length})</SectionTitle>
					</SectionHeader>
					<SectionContent className="grid grid-cols-2 gap-2 px-2 pb-3">
						{tiktokResults.map((result) => (
							<div key={result.id} className="border-border flex flex-col gap-1.5 rounded-md border p-2">
								{result.thumbnail ? (
									<img
										src={result.thumbnail}
										alt={result.desc || result.author}
										referrerPolicy="no-referrer"
										className="aspect-[9/16] w-full rounded-md object-cover"
									/>
								) : (
									<div className="bg-muted text-muted-foreground flex aspect-[9/16] w-full items-center justify-center rounded-md text-xs">
										sem preview
									</div>
								)}
								<p className="truncate text-xs font-medium">{result.author || "—"}</p>
								<p className="text-muted-foreground truncate text-xs">{result.desc}</p>
								<p className="text-muted-foreground text-xs">
									{result.plays.toLocaleString("pt-BR")} plays · {result.likes.toLocaleString("pt-BR")} likes
								</p>
								<div className="flex gap-1.5">
									<Button variant="outline" size="sm" className="flex-1 gap-1.5" asChild>
										<a href={result.link} target="_blank" rel="noreferrer">
											<ExternalLink className="size-3.5" />
											Abrir
										</a>
									</Button>
									<Button
										size="sm"
										className="flex-1 gap-1.5"
										disabled={!result.videoUrl || isImportingId === result.id}
										onClick={() => handleImportTikTokVideo(result)}
									>
										{isImportingId === result.id ? (
											<Spinner className="size-3.5" />
										) : (
											<FolderPlus className="size-3.5" />
										)}
										Importar
									</Button>
								</div>
							</div>
						))}
					</SectionContent>
				</Section>
			)}
		</div>
	);
}
