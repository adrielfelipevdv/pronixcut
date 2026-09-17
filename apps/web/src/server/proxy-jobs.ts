import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { copyFile, mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { getFfmpegPath } from "./ffmpeg-paths";
import { isHevcCodec, probeMediaFile } from "./ffprobe";
import { getProxyCacheDir } from "./media-library-paths";

export type ProxyPurpose = "preview" | "export";
export type ProxyJobStatus = "generating" | "ready" | "error";

export interface ProxyJobSnapshot {
	status: ProxyJobStatus;
	progress: number;
	error: string | null;
	width: number | null;
	height: number | null;
	fps: number | null;
	duration: number | null;
}

interface ProxyJob extends ProxyJobSnapshot {
	purpose: ProxyPurpose;
	sourceDuration: number | null;
	resultPath: string | null;
	workDir: string;
	createdAt: number;
}

const jobs = new Map<string, ProxyJob>();

// Proxy generation is a cache-warming operation, not something a user waits
// on for more than a few minutes — jobs older than this are assumed
// abandoned (tab closed mid-generation, etc.) and swept up on the next call.
const JOB_TTL_MS = 15 * 60 * 1000;

function cleanupStaleJobs(): void {
	const now = Date.now();
	for (const [id, job] of jobs) {
		if (now - job.createdAt > JOB_TTL_MS) {
			void rm(job.workDir, { recursive: true, force: true });
			jobs.delete(id);
		}
	}
}

function ffmpegAvailable(): Promise<boolean> {
	return new Promise((resolve) => {
		const child = spawn(getFfmpegPath(), ["-version"]);
		child.on("error", () => resolve(false));
		child.on("exit", (code) => resolve(code === 0));
	});
}

// Preview proxies just need to be light enough to scrub/play smoothly;
// export proxies need to stay close to source quality since — for sources
// the browser can't decode at all — they stand in for the original at
// render time (see scene-exporter integration). Never upscale either way.
const TARGET_LONG_EDGE: Record<ProxyPurpose, number> = {
	preview: 1280,
	export: 1920,
};

function computeTargetSize({
	width,
	height,
	purpose,
}: {
	width: number | null;
	height: number | null;
	purpose: ProxyPurpose;
}): { width: number; height: number } | null {
	if (!width || !height) return null;
	const cap = TARGET_LONG_EDGE[purpose];
	const longEdge = Math.max(width, height);
	if (longEdge <= cap) return null;

	const scale = cap / longEdge;
	// libx264 requires even dimensions for yuv420p.
	const targetWidth = Math.max(2, Math.round((width * scale) / 2) * 2);
	const targetHeight = Math.max(2, Math.round((height * scale) / 2) * 2);
	return { width: targetWidth, height: targetHeight };
}

function parseOutTimeSeconds(line: string): number | null {
	const match = line.match(/^out_time=(\d+):(\d+):(\d+(?:\.\d+)?)/);
	if (!match) return null;
	const [, h, m, s] = match;
	return Number(h) * 3600 + Number(m) * 60 + Number.parseFloat(s);
}

async function runFfmpegWithProgress({
	args,
	sourceDuration,
	onProgress,
}: {
	args: string[];
	sourceDuration: number | null;
	onProgress: (progress: number) => void;
}): Promise<{ code: number | null; stderr: string }> {
	return new Promise((resolve) => {
		const child = spawn(getFfmpegPath(), args);
		let stderr = "";
		let stdoutBuffer = "";

		child.stdout.on("data", (chunk: Buffer) => {
			stdoutBuffer += chunk.toString();
			const lines = stdoutBuffer.split("\n");
			stdoutBuffer = lines.pop() ?? "";
			for (const line of lines) {
				const seconds = parseOutTimeSeconds(line);
				if (seconds !== null && sourceDuration) {
					onProgress(Math.min(99, Math.max(0, (seconds / sourceDuration) * 100)));
				}
			}
		});
		child.stderr.on("data", (chunk: Buffer) => {
			stderr += chunk.toString();
		});
		child.on("error", () => resolve({ code: -1, stderr: "ffmpeg não encontrado" }));
		child.on("close", (code) => resolve({ code, stderr }));
	});
}

async function runProxyJob({
	jobId,
	inputPath,
	outputPath,
	purpose,
	originalName,
}: {
	jobId: string;
	inputPath: string;
	outputPath: string;
	purpose: ProxyPurpose;
	originalName: string;
}): Promise<void> {
	const job = jobs.get(jobId);
	if (!job) return;

	try {
		const sourceInfo = await probeMediaFile(inputPath);
		job.sourceDuration = sourceInfo.duration;

		const targetSize = computeTargetSize({
			width: sourceInfo.width,
			height: sourceInfo.height,
			purpose,
		});

		const args = [
			"-y",
			"-i",
			inputPath,
			"-map",
			"0:v:0?",
			"-map",
			"0:a:0?",
			"-c:v",
			"libx264",
			"-profile:v",
			"high",
			"-pix_fmt",
			"yuv420p",
			"-preset",
			"veryfast",
			"-crf",
			"20",
			...(targetSize ? ["-vf", `scale=${targetSize.width}:${targetSize.height}`] : []),
			"-c:a",
			"aac",
			"-b:a",
			"192k",
			"-movflags",
			"+faststart",
			"-progress",
			"pipe:1",
			"-nostats",
			outputPath,
		];

		const { code, stderr } = await runFfmpegWithProgress({
			args,
			sourceDuration: sourceInfo.duration,
			onProgress: (progress) => {
				job.progress = progress;
			},
		});

		const outputStat = await stat(outputPath).catch(() => null);
		if (code !== 0 || !outputStat || outputStat.size < 1024) {
			job.status = "error";
			job.error = `Falha ao gerar proxy para ${originalName}: ${stderr.slice(-1500) || "erro desconhecido do ffmpeg"}`;
			return;
		}

		const outputInfo = await probeMediaFile(outputPath).catch(() => null);

		if (outputInfo?.duration != null && sourceInfo.duration != null) {
			const drift = Math.abs(outputInfo.duration - sourceInfo.duration);
			const tolerance = Math.max(0.5, sourceInfo.duration * 0.02);
			if (drift > tolerance) {
				console.error(
					`[proxy-jobs] Duration drift for ${originalName} (job ${jobId}): source=${sourceInfo.duration}s proxy=${outputInfo.duration}s (drift ${drift.toFixed(2)}s)`,
				);
			}
		}

		const persistentPath = path.join(
			getProxyCacheDir(),
			`${jobId}${isHevcCodec(sourceInfo.videoCodec) ? "-hevc" : ""}.mp4`,
		);
		await copyFile(outputPath, persistentPath);

		job.resultPath = persistentPath;
		job.width = outputInfo?.width ?? targetSize?.width ?? sourceInfo.width;
		job.height = outputInfo?.height ?? targetSize?.height ?? sourceInfo.height;
		job.fps = outputInfo?.fps ?? sourceInfo.fps;
		job.duration = outputInfo?.duration ?? sourceInfo.duration;
		job.progress = 100;
		job.status = "ready";
	} catch (error) {
		job.status = "error";
		job.error = error instanceof Error ? error.message : "Falha ao gerar proxy";
	} finally {
		await rm(path.dirname(inputPath), { recursive: true, force: true }).catch(() => {});
	}
}

export async function startProxyJob({
	file,
	purpose,
}: {
	file: File;
	purpose: ProxyPurpose;
}): Promise<{ jobId: string } | { error: string }> {
	cleanupStaleJobs();

	if (!(await ffmpegAvailable())) {
		return {
			error: "Não foi possível preparar este vídeo para edição: o ffmpeg interno do PronixCut não está disponível.",
		};
	}

	const workDir = await mkdtemp(path.join(tmpdir(), "pronix-proxy-"));
	const inputExt = path.extname(file.name) || ".mp4";
	const inputPath = path.join(workDir, `in${inputExt}`);
	const outputPath = path.join(workDir, "proxy.mp4");
	await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));

	const jobId = randomUUID();
	jobs.set(jobId, {
		status: "generating",
		progress: 0,
		error: null,
		width: null,
		height: null,
		fps: null,
		duration: null,
		purpose,
		sourceDuration: null,
		resultPath: null,
		workDir,
		createdAt: Date.now(),
	});

	void runProxyJob({ jobId, inputPath, outputPath, purpose, originalName: file.name });

	return { jobId };
}

export function getJobSnapshot(jobId: string): ProxyJobSnapshot | null {
	const job = jobs.get(jobId);
	if (!job) return null;
	return {
		status: job.status,
		progress: job.progress,
		error: job.error,
		width: job.width,
		height: job.height,
		fps: job.fps,
		duration: job.duration,
	};
}

export async function readJobResult(jobId: string): Promise<Buffer | null> {
	const job = jobs.get(jobId);
	if (!job || job.status !== "ready" || !job.resultPath) return null;
	return readFile(job.resultPath);
}

export function completeJob(jobId: string): void {
	const job = jobs.get(jobId);
	if (!job) return;
	if (job.resultPath) {
		void rm(job.resultPath, { force: true });
	}
	jobs.delete(jobId);
}
