import { createReadStream } from "node:fs";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { Readable } from "node:stream";
import { NextResponse } from "next/server";
import { getAudioLibraryDir, getAudioLibraryIndexPath } from "@/server/media-library-paths";
import type { AudioLibraryItem } from "../../route";

async function readIndex(): Promise<AudioLibraryItem[]> {
	try {
		const raw = await readFile(getAudioLibraryIndexPath(), "utf8");
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export async function GET(request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const items = await readIndex();
	const item = items.find((entry) => entry.id === id);
	if (!item) {
		return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
	}

	const filePath = path.join(getAudioLibraryDir(), item.storedFilename);
	const fileStat = await stat(filePath).catch(() => null);
	if (!fileStat) {
		return NextResponse.json({ error: "Arquivo não encontrado no disco." }, { status: 404 });
	}

	const range = request.headers.get("range");
	if (!range) {
		const stream = Readable.toWeb(createReadStream(filePath)) as unknown as ReadableStream;
		return new NextResponse(stream, {
			headers: {
				"Content-Type": item.mimeType,
				"Content-Length": String(fileStat.size),
				"Accept-Ranges": "bytes",
			},
		});
	}

	const match = /bytes=(\d*)-(\d*)/.exec(range);
	const start = match?.[1] ? Number.parseInt(match[1], 10) : 0;
	const end = match?.[2] ? Number.parseInt(match[2], 10) : fileStat.size - 1;
	const chunkSize = end - start + 1;

	const stream = Readable.toWeb(createReadStream(filePath, { start, end })) as unknown as ReadableStream;
	return new NextResponse(stream, {
		status: 206,
		headers: {
			"Content-Type": item.mimeType,
			"Content-Length": String(chunkSize),
			"Content-Range": `bytes ${start}-${end}/${fileStat.size}`,
			"Accept-Ranges": "bytes",
		},
	});
}
