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
import { Textarea } from "@/components/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/components/ui/select";
import { Spinner } from "@/components/ui/spinner";
import { Download, FolderPlus, Trash2, Check, X } from "lucide-react";
import { useEditor } from "@/editor/use-editor";
import { processMediaAssets } from "@/media/processing";
import { AddMediaAssetCommand } from "@/commands/media";
import { generateUUID } from "@/utils/id";
import {
	usePronixEditorStore,
	type PronixEditorAspectRatio,
	type PronixEditorProvider,
} from "@/pronix-editor/store";

const IMAGE_PROVIDER_LABELS: Record<PronixEditorProvider, string> = {
	openai: "OpenAI (gpt-image-1)",
	gemini: "Google Gemini (Nano Banana)",
};

const ASPECT_RATIO_LABELS: Record<PronixEditorAspectRatio, string> = {
	"1:1": "Quadrado (1:1)",
	"9:16": "Vertical (9:16)",
	"16:9": "Horizontal (16:9)",
};

const VARIATION_COUNTS = [1, 2, 3, 4] as const;

function dataUrlToFile({ dataUrl, filename }: { dataUrl: string; filename: string }): File {
	const [header, base64] = dataUrl.split(",");
	const mimeMatch = header.match(/data:(.*?);base64/);
	const mimeType = mimeMatch?.[1] ?? "image/png";
	const binary = atob(base64);
	const bytes = new Uint8Array(binary.length);
	for (let i = 0; i < binary.length; i++) {
		bytes[i] = binary.charCodeAt(i);
	}
	return new File([bytes], filename, { type: mimeType });
}

export function VisualAiTab() {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActiveOrNull());
	const {
		provider,
		setProvider,
		integrations,
		requireApprovalBeforeAdding,
		aspectRatio,
		setAspectRatio,
		prompt,
		setPrompt,
		results,
		addResults,
		removeResult,
		setResultApproval,
		logEvent,
		checkDailyLimit,
		recordGeneration,
	} = usePronixEditorStore();

	const [style, setStyle] = useState("");
	const [variationCount, setVariationCount] = useState<number>(1);
	const [isGenerating, setIsGenerating] = useState(false);
	const [addingId, setAddingId] = useState<string | null>(null);

	const enabledImageProviders = (
		Object.keys(IMAGE_PROVIDER_LABELS) as PronixEditorProvider[]
	).filter((key) => integrations[key].enabled);
	const apiKey = integrations[provider]?.apiKey ?? "";
	const isReady = integrations[provider]?.enabled && apiKey.trim().length > 0;

	const handleGenerate = async () => {
		if (!prompt.trim()) return;

		if (!integrations[provider].enabled) {
			toast.error("Esse provedor está desativado", {
				description: "Ative-o em Integrações.",
			});
			return;
		}
		if (!apiKey.trim()) {
			toast.error("Configure sua chave de API primeiro", {
				description: `Cole sua chave da ${IMAGE_PROVIDER_LABELS[provider]} em Integrações.`,
			});
			return;
		}
		const limitError = checkDailyLimit();
		if (limitError) {
			toast.error("Limite diário atingido", { description: limitError });
			return;
		}

		setIsGenerating(true);
		try {
			const fullPrompt = style.trim() ? `${prompt} Estilo: ${style}.` : prompt;
			const response = await fetch("/api/pronix-editor/generate-image", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					provider,
					apiKey,
					prompt: fullPrompt,
					aspectRatio,
					n: variationCount,
				}),
			});
			const data = await response.json();

			if (!response.ok) {
				throw new Error(data.error ?? "Falha ao gerar imagem.");
			}

			const images = data.images as { dataUrl: string }[];
			addResults(
				images.map((image) => ({
					id: generateUUID(),
					prompt,
					dataUrl: image.dataUrl,
					createdAt: new Date().toISOString(),
				})),
			);
			recordGeneration(images.length);
			logEvent({
				type: "generate",
				provider,
				detail: `Gerou ${images.length} imagem(ns) para "${prompt.slice(0, 60)}"`,
			});
		} catch (error) {
			toast.error("Falha ao gerar imagem", {
				description: error instanceof Error ? error.message : undefined,
			});
			logEvent({
				type: "error",
				provider,
				detail: error instanceof Error ? error.message : "Falha desconhecida",
			});
		} finally {
			setIsGenerating(false);
		}
	};

	const handleAddToLibrary = async (result: { id: string; dataUrl: string; prompt: string }) => {
		if (!activeProject) return;
		setAddingId(result.id);
		try {
			const file = dataUrlToFile({
				dataUrl: result.dataUrl,
				filename: `pronix-ai-${result.id}.png`,
			});
			const [processedAsset] = await processMediaAssets({ files: [file] });
			if (!processedAsset) throw new Error("Falha ao processar a imagem gerada.");

			const addMediaCmd = new AddMediaAssetCommand({
				projectId: activeProject.metadata.id,
				asset: processedAsset,
			});
			editor.command.execute({ command: addMediaCmd });
			toast.success("Imagem adicionada à biblioteca de mídia");
			logEvent({ type: "import", detail: "Imagem adicionada à biblioteca" });
		} catch (error) {
			toast.error("Falha ao adicionar à biblioteca", {
				description: error instanceof Error ? error.message : undefined,
			});
		} finally {
			setAddingId(null);
		}
	};

	const handleDownload = (result: { dataUrl: string; id: string }) => {
		const link = document.createElement("a");
		link.href = result.dataUrl;
		link.download = `pronix-ai-${result.id}.png`;
		document.body.appendChild(link);
		link.click();
		document.body.removeChild(link);
	};

	return (
		<div className="flex flex-col">
			{!isReady && (
				<div className="bg-accent/50 mx-2 mt-2 rounded-md p-2 text-xs">
					Nenhum provedor de imagem pronto. Ative e configure a chave em{" "}
					<span className="text-foreground">Integrações</span>.
				</div>
			)}
			<Section showTopBorder={false}>
				<SectionHeader>
					<SectionTitle className="flex-1">Prompt</SectionTitle>
				</SectionHeader>
				<SectionContent className="flex flex-col gap-2 px-2 pb-3">
					<Textarea
						placeholder="Ex.: Criar uma imagem da empresa Amazon com a logo em neon"
						value={prompt}
						onChange={(event) => setPrompt(event.target.value)}
						className="min-h-20 resize-none text-sm"
					/>
					<div className="grid grid-cols-2 gap-2">
						<Select
							value={provider}
							onValueChange={(value) => setProvider(value as PronixEditorProvider)}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{(Object.keys(IMAGE_PROVIDER_LABELS) as PronixEditorProvider[]).map((key) => (
									<SelectItem key={key} value={key} disabled={!integrations[key].enabled}>
										{IMAGE_PROVIDER_LABELS[key]}
										{!integrations[key].enabled ? " (desativado)" : ""}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select
							value={aspectRatio}
							onValueChange={(value) => setAspectRatio(value as PronixEditorAspectRatio)}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{(Object.keys(ASPECT_RATIO_LABELS) as PronixEditorAspectRatio[]).map((key) => (
									<SelectItem key={key} value={key}>
										{ASPECT_RATIO_LABELS[key]}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Select
							value={String(variationCount)}
							onValueChange={(value) => setVariationCount(Number(value))}
						>
							<SelectTrigger className="w-full">
								<SelectValue />
							</SelectTrigger>
							<SelectContent>
								{VARIATION_COUNTS.map((count) => (
									<SelectItem key={count} value={String(count)}>
										{count} variação{count > 1 ? "ões" : ""}
									</SelectItem>
								))}
							</SelectContent>
						</Select>
						<Input
							value={style}
							onChange={(event) => setStyle(event.target.value)}
							placeholder="Estilo (opcional): cinematográfico, neon..."
						/>
					</div>
					<Button
						onClick={handleGenerate}
						disabled={isGenerating || !prompt.trim() || enabledImageProviders.length === 0}
						className="w-full gap-2"
					>
						{isGenerating ? <Spinner className="size-4" /> : null}
						{isGenerating ? "Gerando..." : "Gerar imagem"}
					</Button>
				</SectionContent>
			</Section>

			{results.length > 0 && (
				<Section showTopBorder={false}>
					<SectionHeader>
						<SectionTitle className="flex-1">Resultado</SectionTitle>
					</SectionHeader>
					<SectionContent className="grid grid-cols-2 gap-2 px-2 pb-3">
						{results.map((result) => {
							const canAdd = !requireApprovalBeforeAdding || result.approvalStatus === "approved";
							return (
								<div
									key={result.id}
									className="border-border bg-card group relative flex flex-col overflow-hidden rounded-md border"
								>
									{/* eslint-disable-next-line @next/next/no-img-element -- generated data: URLs */}
									<img
										src={result.dataUrl}
										alt={result.prompt}
										className="aspect-square w-full object-cover"
									/>
									{requireApprovalBeforeAdding && result.approvalStatus === "pending" && (
										<div className="flex items-center justify-center gap-1 p-1">
											<Button
												variant="ghost"
												size="icon"
												className="text-constructive size-7"
												aria-label="Aprovar"
												title="Aprovar"
												onClick={() => setResultApproval({ id: result.id, status: "approved" })}
											>
												<Check className="size-3.5" />
											</Button>
											<Button
												variant="ghost"
												size="icon"
												className="text-destructive size-7"
												aria-label="Reprovar"
												title="Reprovar"
												onClick={() => setResultApproval({ id: result.id, status: "rejected" })}
											>
												<X className="size-3.5" />
											</Button>
										</div>
									)}
									<div className="flex items-center justify-between gap-1 p-1">
										<Button
											variant="ghost"
											size="icon"
											className="size-7"
											disabled={!activeProject || addingId === result.id || !canAdd}
											aria-label="Adicionar à biblioteca"
											title={canAdd ? "Adicionar à biblioteca" : "Aprove esta imagem primeiro"}
											onClick={() => handleAddToLibrary(result)}
										>
											{addingId === result.id ? (
												<Spinner className="size-3.5" />
											) : (
												<FolderPlus className="size-3.5" />
											)}
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="size-7"
											aria-label="Baixar"
											title="Baixar"
											onClick={() => handleDownload(result)}
										>
											<Download className="size-3.5" />
										</Button>
										<Button
											variant="ghost"
											size="icon"
											className="size-7"
											aria-label="Remover"
											title="Remover"
											onClick={() => removeResult(result.id)}
										>
											<Trash2 className="size-3.5" />
										</Button>
									</div>
								</div>
							);
						})}
					</SectionContent>
				</Section>
			)}
		</div>
	);
}
