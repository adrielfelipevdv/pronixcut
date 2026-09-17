import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getFfmpegPath } from "@/server/ffmpeg-paths";

const MAX_BYTES = 4 * 1024 * 1024 * 1024;

function extractFrame({
	inputPath,
	outputPath,
	seekSeconds,
}: {
	inputPath: string;
	outputPath: string;
	seekSeconds: number;
}): Promise<{ code: number | null; stderr: string }> {
	return new Promise((resolve) => {
		const child = spawn(getFfmpegPath(), [
			"-y",
			"-ss",
			String(seekSeconds),
			"-i",
			inputPath,
			"-vframes",
			"1",
			"-vf",
			"scale=320:-2",
			outputPath,
		]);
		let stderr = "";
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", () => resolve({ code: -1, stderr: "ffmpeg não encontrado" }));
		child.on("close", (code) => resolve({ code, stderr }));
	});
}

// Used only for sources mediabunny/WebCodecs can't sample a frame from
// (HEVC and similar) — ffmpeg can decode almost anything regardless of
// browser support, so this doesn't depend on the same canDecode() gate.
export async function POST(request: NextRequest) {
	const formData = await request.formData();
	const file = formData.get("file");
	if (!(file instanceof File)) {
		return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
	}
	if (file.size > MAX_BYTES) {
		return NextResponse.json({ error: "Arquivo excede o limite de 4GB." }, { status: 413 });
	}

	const workDir = await mkdtemp(path.join(tmpdir(), "pronix-thumb-"));
	const inputExt = path.extname(file.name) || ".mp4";
	const inputPath = path.join(workDir, `in${inputExt}`);
	const outputPath = path.join(workDir, "thumb.jpg");

	try {
		await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));

		let { code } = await extractFrame({ inputPath, outputPath, seekSeconds: 1 });
		let outputStat = await stat(outputPath).catch(() => null);

		if (code !== 0 || !outputStat) {
			({ code } = await extractFrame({ inputPath, outputPath, seekSeconds: 0 }));
			outputStat = await stat(outputPath).catch(() => null);
		}

		if (code !== 0 || !outputStat) {
			return NextResponse.json({ error: "Não foi possível gerar a miniatura." }, { status: 500 });
		}

		const output = await readFile(outputPath);
		return new NextResponse(new Uint8Array(output), {
			headers: { "Content-Type": "image/jpeg" },
		});
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Falha ao gerar a miniatura." },
			{ status: 500 },
		);
	} finally {
		await rm(workDir, { recursive: true, force: true });
	}
}
