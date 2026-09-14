import { randomUUID } from "node:crypto";
import { spawn } from "node:child_process";
import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { type NextRequest, NextResponse } from "next/server";
import { getAudioLibraryDir, getAudioLibraryIndexPath } from "@/server/media-library-paths";

// Cross-project local audio library backing "Áudio > Sounds & effects".
// Files are COPIED into PronixCut's own persistent app-data directory on
// import (never just a reference to the original path), so moving/deleting
// the user's original file afterwards can't break the library — matches
// the per-project media pipeline's "copy the bytes in, don't just keep a
// path" behavior, done here at the filesystem level since this library is
// shared across projects and needs a stable, fetchable URL (see
// media/audio.ts's fetch(element.sourceUrl) at playback time).

export interface AudioLibraryItem {
	id: string;
	name: string;
	storedFilename: string;
	mimeType: string;
	size: number;
	duration: number | null;
	importedAt: string;
}

const ALLOWED_EXTENSIONS = new Set([".mp3", ".wav", ".m4a", ".aac", ".ogg", ".flac"]);
const MIME_BY_EXT: Record<string, string> = {
	".mp3": "audio/mpeg",
	".wav": "audio/wav",
	".m4a": "audio/mp4",
	".aac": "audio/aac",
	".ogg": "audio/ogg",
	".flac": "audio/flac",
};
const MAX_BYTES = 300 * 1024 * 1024;

async function readIndex(): Promise<AudioLibraryItem[]> {
	try {
		const raw = await readFile(getAudioLibraryIndexPath(), "utf8");
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

async function writeIndex(items: AudioLibraryItem[]): Promise<void> {
	await writeFile(getAudioLibraryIndexPath(), JSON.stringify(items, null, 2), "utf8");
}

function probeDuration(filePath: string): Promise<number | null> {
	return new Promise((resolve) => {
		const child = spawn("ffprobe", [
			"-v",
			"error",
			"-show_entries",
			"format=duration",
			"-of",
			"default=noprint_wrappers=1:nokey=1",
			filePath,
		]);
		let stdout = "";
		child.stdout.on("data", (chunk) => {
			stdout += chunk.toString();
		});
		child.on("error", () => resolve(null));
		child.on("close", (code) => {
			if (code !== 0) return resolve(null);
			const value = Number.parseFloat(stdout.trim());
			resolve(Number.isFinite(value) ? value : null);
		});
	});
}

export async function GET() {
	const items = await readIndex();
	return NextResponse.json({ items });
}

export async function POST(request: NextRequest) {
	const formData = await request.formData();
	const file = formData.get("file");
	if (!(file instanceof File)) {
		return NextResponse.json({ error: "Nenhum arquivo enviado." }, { status: 400 });
	}
	if (file.size > MAX_BYTES) {
		return NextResponse.json({ error: "Arquivo excede o limite de 300MB." }, { status: 413 });
	}

	const ext = path.extname(file.name).toLowerCase();
	if (!ALLOWED_EXTENSIONS.has(ext)) {
		return NextResponse.json(
			{ error: `Formato não suportado (${ext || "sem extensão"}). Use mp3, wav, m4a, aac, ogg ou flac.` },
			{ status: 400 },
		);
	}

	const id = randomUUID();
	const storedFilename = `${id}${ext}`;
	const destPath = path.join(getAudioLibraryDir(), storedFilename);

	try {
		await writeFile(destPath, Buffer.from(await file.arrayBuffer()));
		const duration = await probeDuration(destPath);

		const item: AudioLibraryItem = {
			id,
			name: file.name,
			storedFilename,
			mimeType: MIME_BY_EXT[ext] ?? file.type ?? "application/octet-stream",
			size: file.size,
			duration,
			importedAt: new Date().toISOString(),
		};

		const items = await readIndex();
		items.unshift(item);
		await writeIndex(items);

		return NextResponse.json({ item });
	} catch (error) {
		await unlink(destPath).catch(() => {});
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Falha ao importar o áudio." },
			{ status: 500 },
		);
	}
}
