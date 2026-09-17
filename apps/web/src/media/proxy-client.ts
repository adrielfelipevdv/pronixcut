export type ProxyPurpose = "preview" | "export";

export interface ProxyJobSnapshot {
	status: "generating" | "ready" | "error";
	progress: number;
	error: string | null;
	width: number | null;
	height: number | null;
	fps: number | null;
	duration: number | null;
}

const POLL_INTERVAL_MS = 500;

export async function startProxyJob({
	file,
	purpose,
}: {
	file: File;
	purpose: ProxyPurpose;
}): Promise<string> {
	const formData = new FormData();
	formData.append("file", file);
	formData.append("purpose", purpose);

	const response = await fetch("/api/media/proxy/start", {
		method: "POST",
		body: formData,
	});

	const body: { jobId?: string; error?: string } = await response.json();
	if (!response.ok || !body.jobId) {
		throw new Error(body?.error ?? "Falha ao iniciar a geração do proxy.");
	}

	return body.jobId;
}

export async function waitForProxyJob({
	jobId,
	onProgress,
	signal,
}: {
	jobId: string;
	onProgress?: (snapshot: ProxyJobSnapshot) => void;
	signal?: AbortSignal;
}): Promise<ProxyJobSnapshot> {
	while (true) {
		if (signal?.aborted) {
			throw new Error("Geração de proxy cancelada.");
		}

		const response = await fetch(`/api/media/proxy/status?jobId=${jobId}`, {
			signal,
		});
		if (!response.ok) {
			const body = await response.json().catch(() => null);
			throw new Error(body?.error ?? "Falha ao consultar o status do proxy.");
		}

		const snapshot: ProxyJobSnapshot = await response.json();
		onProgress?.(snapshot);

		if (snapshot.status === "ready" || snapshot.status === "error") {
			return snapshot;
		}

		await new Promise((resolve) => setTimeout(resolve, POLL_INTERVAL_MS));
	}
}

export async function fetchProxyResult({
	jobId,
	fileName,
}: {
	jobId: string;
	fileName: string;
}): Promise<File> {
	const response = await fetch(`/api/media/proxy/result?jobId=${jobId}`);
	if (!response.ok) {
		const body = await response.json().catch(() => null);
		throw new Error(body?.error ?? "Falha ao obter o arquivo de proxy.");
	}

	const blob = await response.blob();
	return new File([blob], fileName, { type: "video/mp4" });
}

export async function generateProxyFile({
	sourceFile,
	purpose,
	proxyFileName,
	onProgress,
}: {
	sourceFile: File;
	purpose: ProxyPurpose;
	proxyFileName: string;
	onProgress?: (progress: number) => void;
}): Promise<File> {
	const jobId = await startProxyJob({ file: sourceFile, purpose });
	const finalSnapshot = await waitForProxyJob({
		jobId,
		onProgress: (snapshot) => onProgress?.(snapshot.progress),
	});

	if (finalSnapshot.status === "error" || !finalSnapshot) {
		throw new Error(finalSnapshot.error ?? "Falha ao gerar o proxy de vídeo.");
	}

	return fetchProxyResult({ jobId, fileName: proxyFileName });
}

export async function generateThumbnail({ file }: { file: File }): Promise<string | null> {
	const formData = new FormData();
	formData.append("file", file);

	try {
		const response = await fetch("/api/media/thumbnail", {
			method: "POST",
			body: formData,
		});
		if (!response.ok) return null;

		const blob = await response.blob();
		return await new Promise<string>((resolve, reject) => {
			const reader = new FileReader();
			reader.onload = () => {
				if (typeof reader.result === "string") {
					resolve(reader.result);
				} else {
					reject(new Error("Falha ao ler a miniatura."));
				}
			};
			reader.onerror = () => reject(new Error("Falha ao ler a miniatura."));
			reader.readAsDataURL(blob);
		});
	} catch {
		return null;
	}
}
