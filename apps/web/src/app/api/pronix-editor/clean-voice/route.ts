import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { mkdtemp, readFile, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";

// Ported from the original PronixEditor's audio/clean.py. DaVinci Resolve's
// native "Voice Isolation" is a Fairlight preset applied via
// Timeline.ApplyFairlightPreset() — scripting-API-only, reachable solely
// from inside a running Resolve process with a Fairlight timeline open.
// PronixCut has no such process to call into, so — exactly like the
// original engine does for the same reason ("Voice Isolation nativa do
// Resolve não é scriptável, então tratamos o áudio fora e reimportamos") —
// this runs the same ffmpeg filter chain externally instead: highpass ->
// afftdn (FFT denoise) -> acompressor -> loudnorm. Same filters, same
// default parameters as build_chain()'s defaults in the original.

const MAX_BYTES = 500 * 1024 * 1024; // 500MB safety cap for source clips

function ffmpegAvailable(): Promise<boolean> {
	return new Promise((resolve) => {
		const child = spawn("ffmpeg", ["-version"]);
		child.on("error", () => resolve(false));
		child.on("exit", (code) => resolve(code === 0));
	});
}

function runFfmpeg(args: string[]): Promise<{ code: number | null; stderr: string }> {
	return new Promise((resolve) => {
		const child = spawn("ffmpeg", args);
		let stderr = "";
		child.stderr.on("data", (chunk) => {
			stderr += chunk.toString();
		});
		child.on("error", () => resolve({ code: -1, stderr: "ffmpeg não encontrado" }));
		child.on("close", (code) => resolve({ code, stderr }));
	});
}

export async function POST(request: NextRequest) {
	if (!(await ffmpegAvailable())) {
		return NextResponse.json(
			{
				error:
					"ffmpeg não foi encontrado no sistema. Instale o ffmpeg e garanta que ele esteja no PATH do sistema para usar a limpeza de voz.",
			},
			{ status: 501 },
		);
	}

	const formData = await request.formData();
	const file = formData.get("file");
	if (!(file instanceof File)) {
		return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
	}
	if (file.size > MAX_BYTES) {
		return NextResponse.json({ error: "Arquivo excede o limite de 500MB." }, { status: 413 });
	}

	const workDir = await mkdtemp(path.join(tmpdir(), "pronix-clean-voice-"));
	const inputExt = path.extname(file.name) || ".mp4";
	const inputPath = path.join(workDir, `in${inputExt}`);
	const outputPath = path.join(workDir, "out.wav");

	try {
		await writeFile(inputPath, Buffer.from(await file.arrayBuffer()));

		// Same chain as build_chain() with the original's defaults: eq (highpass
		// 75Hz), denoise (afftdn nr=12 nf=-25), compress (acompressor), normalize
		// (loudnorm to -14 LUFS).
		const filterChain = [
			"highpass=f=75",
			"afftdn=nr=12:nf=-25",
			"acompressor=threshold=-18dB:ratio=3:attack=20:release=250",
			"loudnorm=I=-14:TP=-1.5:LRA=11",
		].join(",");

		const { code, stderr } = await runFfmpeg([
			"-y",
			"-i",
			inputPath,
			"-vn",
			"-af",
			filterChain,
			"-ar",
			"48000",
			"-c:a",
			"pcm_s16le",
			outputPath,
		]);

		const outputStat = await stat(outputPath).catch(() => null);
		if (code !== 0 || !outputStat || outputStat.size < 10_000) {
			return NextResponse.json(
				{ error: `Falha na limpeza de áudio: ${stderr.slice(-1500) || "erro desconhecido do ffmpeg"}` },
				{ status: 500 },
			);
		}

		const output = await readFile(outputPath);
		return new NextResponse(new Uint8Array(output), {
			headers: {
				"Content-Type": "audio/wav",
				"Content-Disposition": `attachment; filename="voz-limpa-${randomUUID()}.wav"`,
			},
		});
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Falha ao processar o áudio." },
			{ status: 500 },
		);
	} finally {
		await rm(workDir, { recursive: true, force: true });
	}
}
