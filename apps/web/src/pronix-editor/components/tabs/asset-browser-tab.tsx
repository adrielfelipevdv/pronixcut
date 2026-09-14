"use client";

import { createElement, useEffect, useRef, useState } from "react";
import { toast } from "sonner";
import {
	Section,
	SectionContent,
	SectionHeader,
	SectionTitle,
} from "@/components/section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { FolderPlus } from "lucide-react";
import { useEditor } from "@/editor/use-editor";
import { processMediaAssets } from "@/media/processing";
import { AddMediaAssetCommand } from "@/commands/media";
import { usePronixEditorStore } from "@/pronix-editor/store";

type WebviewElement = HTMLElement & {
	src: string;
	loadURL: (url: string) => void;
	goBack: () => void;
	goForward: () => void;
	reload: () => void;
	getURL: () => string;
};

const SITES = [
	{ label: "Google Imagens", url: "https://www.google.com/imghp" },
	{ label: "Unsplash", url: "https://unsplash.com" },
	{ label: "Pexels", url: "https://www.pexels.com" },
	{ label: "Pixabay", url: "https://pixabay.com" },
] as const;
const HOME = SITES[0].url;

function normalizeUrl(input: string): string {
	const trimmed = input.trim();
	if (!trimmed) return "";
	if (/^https?:\/\//i.test(trimmed)) return trimmed;
	if (/^[\w-]+(\.[\w-]+)+/.test(trimmed)) return `https://${trimmed}`;
	return `https://www.google.com/search?tbm=isch&q=${encodeURIComponent(trimmed)}`;
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

export function AssetBrowserTab() {
	const editor = useEditor();
	const activeProject = useEditor((e) => e.project.getActiveOrNull());
	const { logEvent } = usePronixEditorStore();
	const webviewRef = useRef<WebviewElement | null>(null);
	const [address, setAddress] = useState<string>(HOME);
	const [downloadUrl, setDownloadUrl] = useState("");
	const [isDownloading, setIsDownloading] = useState(false);
	const [isWebviewSupported, setIsWebviewSupported] = useState(true);

	useEffect(() => {
		const webview = webviewRef.current;
		if (!webview) return;
		const onNavigate = () => {
			try {
				setAddress(webview.getURL());
			} catch {
				// webview not ready yet
			}
		};
		webview.addEventListener("did-navigate", onNavigate);
		webview.addEventListener("did-navigate-in-page", onNavigate);
		webview.addEventListener("did-fail-load", () => setIsWebviewSupported(false));
		return () => {
			webview.removeEventListener("did-navigate", onNavigate);
			webview.removeEventListener("did-navigate-in-page", onNavigate);
		};
	}, []);

	const navigate = (to: string) => {
		const url = normalizeUrl(to);
		if (!url) return;
		setAddress(url);
		try {
			webviewRef.current?.loadURL(url);
		} catch {
			// webview not mounted yet
		}
	};

	const handleDownload = async ({ importToLibrary }: { importToLibrary: boolean }) => {
		const url = downloadUrl.trim();
		if (!url) {
			toast.error("Cole o link direto do arquivo");
			return;
		}
		setIsDownloading(true);
		try {
			const response = await fetch("/api/pronix-editor/download-asset", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ url }),
			});
			const data = await response.json();
			if (!response.ok) throw new Error(data.error ?? "Falha ao baixar.");

			if (!importToLibrary) {
				const link = document.createElement("a");
				link.href = data.dataUrl;
				link.download = url.split("/").pop() ?? "download";
				document.body.appendChild(link);
				link.click();
				document.body.removeChild(link);
				toast.success("Arquivo baixado");
				return;
			}

			if (!activeProject) {
				toast.error("Abra um projeto antes de importar");
				return;
			}

			const file = dataUrlToFile({
				dataUrl: data.dataUrl,
				mimeType: data.mimeType,
				filename: url.split("/").pop() ?? "asset",
			});
			const [processedAsset] = await processMediaAssets({ files: [file] });
			if (!processedAsset) throw new Error("Falha ao processar o arquivo baixado.");

			editor.command.execute({
				command: new AddMediaAssetCommand({
					projectId: activeProject.metadata.id,
					asset: processedAsset,
				}),
			});
			toast.success("Baixado e adicionado à biblioteca");
			logEvent({ type: "asset-download", detail: `Baixou e importou ${url}` });
			setDownloadUrl("");
		} catch (error) {
			toast.error("Falha ao baixar", {
				description: error instanceof Error ? error.message : undefined,
			});
		} finally {
			setIsDownloading(false);
		}
	};

	return (
		<div className="flex flex-col">
			<Section showTopBorder={false}>
				<SectionHeader>
					<SectionTitle className="flex-1">Navegador</SectionTitle>
				</SectionHeader>
				<SectionContent className="flex flex-col gap-2 px-2 pb-3">
					<p className="text-muted-foreground text-xs">
						⚠️ Os direitos autorais dos assets encontrados aqui são de sua
						responsabilidade.
					</p>
					<div className="flex gap-1">
						<Button variant="outline" size="icon" className="size-8" onClick={() => webviewRef.current?.goBack()}>
							‹
						</Button>
						<Button variant="outline" size="icon" className="size-8" onClick={() => webviewRef.current?.goForward()}>
							›
						</Button>
						<Button variant="outline" size="icon" className="size-8" onClick={() => webviewRef.current?.reload()}>
							⟳
						</Button>
						<Input
							value={address}
							onChange={(event) => setAddress(event.target.value)}
							onKeyDown={(event) => {
								if (event.key === "Enter") navigate(address);
							}}
							placeholder="Digite um endereço ou termo de busca..."
							className="flex-1"
						/>
						<Button onClick={() => navigate(address)}>Ir</Button>
					</div>
					<div className="flex flex-wrap gap-1">
						{SITES.map((site) => (
							<Button
								key={site.url}
								variant="outline"
								size="sm"
								className="h-6 px-2 text-xs"
								onClick={() => navigate(site.url)}
							>
								{site.label}
							</Button>
						))}
					</div>
					<div className="bg-muted h-80 w-full overflow-hidden rounded-md">
						{createElement("webview", {
							ref: webviewRef,
							src: HOME,
							style: { width: "100%", height: "100%" },
							allowpopups: "true",
							partition: "persist:pronix-assets",
						})}
					</div>
					{!isWebviewSupported && (
						<p className="text-muted-foreground text-xs">
							O navegador embutido não pôde carregar. Copie o link da imagem
							diretamente e cole no campo abaixo.
						</p>
					)}
				</SectionContent>
			</Section>

			<Section showTopBorder={false}>
				<SectionHeader>
					<SectionTitle className="flex-1">Baixar asset</SectionTitle>
				</SectionHeader>
				<SectionContent className="flex flex-col gap-2 px-2 pb-3">
					<p className="text-muted-foreground text-xs">
						Ache a imagem acima, clique com o botão direito → "Copiar endereço da
						imagem" e cole o link aqui.
					</p>
					<Input
						value={downloadUrl}
						onChange={(event) => setDownloadUrl(event.target.value)}
						placeholder="Link direto do arquivo (https://.../imagem.jpg)"
					/>
					<div className="flex flex-wrap gap-2">
						<Button
							variant="outline"
							disabled={isDownloading}
							onClick={() => handleDownload({ importToLibrary: false })}
							className="gap-2"
						>
							{isDownloading ? <Spinner className="size-4" /> : null}
							Baixar
						</Button>
						<Button
							disabled={isDownloading}
							onClick={() => handleDownload({ importToLibrary: true })}
							className="gap-2"
						>
							<FolderPlus className="size-4" />
							Baixar e adicionar à biblioteca
						</Button>
					</div>
				</SectionContent>
			</Section>
		</div>
	);
}
