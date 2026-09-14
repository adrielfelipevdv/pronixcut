import { readFile, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import { NextResponse } from "next/server";
import { getAudioLibraryDir, getAudioLibraryIndexPath } from "@/server/media-library-paths";
import type { AudioLibraryItem } from "../route";

async function readIndex(): Promise<AudioLibraryItem[]> {
	try {
		const raw = await readFile(getAudioLibraryIndexPath(), "utf8");
		const parsed = JSON.parse(raw);
		return Array.isArray(parsed) ? parsed : [];
	} catch {
		return [];
	}
}

export async function DELETE(_request: Request, { params }: { params: Promise<{ id: string }> }) {
	const { id } = await params;
	const items = await readIndex();
	const item = items.find((entry) => entry.id === id);
	if (!item) {
		return NextResponse.json({ error: "Item não encontrado." }, { status: 404 });
	}

	await unlink(path.join(getAudioLibraryDir(), item.storedFilename)).catch(() => {});
	const remaining = items.filter((entry) => entry.id !== id);
	await writeFile(getAudioLibraryIndexPath(), JSON.stringify(remaining, null, 2), "utf8");

	return NextResponse.json({ ok: true });
}
