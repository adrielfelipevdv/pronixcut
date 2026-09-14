import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Downloads a direct asset URL server-side (avoids the browser's CORS
// restrictions when fetching from arbitrary third-party image hosts) and
// returns it as a data URL for the client to add to the media library.
// Mirrors the original PronixEditor Asset Browser's "download" action.

const requestSchema = z.object({
	url: z.string().url(),
});

const MAX_BYTES = 50 * 1024 * 1024; // 50MB safety cap

export async function POST(request: NextRequest) {
	const body = await request.json();
	const result = requestSchema.safeParse(body);

	if (!result.success) {
		return NextResponse.json({ error: "URL inválida" }, { status: 400 });
	}

	try {
		const response = await fetch(result.data.url);
		if (!response.ok) {
			return NextResponse.json(
				{ error: `Falha ao baixar (${response.status})` },
				{ status: 502 },
			);
		}

		const contentLength = Number(response.headers.get("content-length") ?? "0");
		if (contentLength > MAX_BYTES) {
			return NextResponse.json({ error: "Arquivo muito grande (limite 50MB)" }, { status: 413 });
		}

		const mimeType = response.headers.get("content-type") ?? "application/octet-stream";
		const buffer = Buffer.from(await response.arrayBuffer());
		if (buffer.byteLength > MAX_BYTES) {
			return NextResponse.json({ error: "Arquivo muito grande (limite 50MB)" }, { status: 413 });
		}

		return NextResponse.json({
			dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
			mimeType,
		});
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Falha ao baixar o arquivo." },
			{ status: 502 },
		);
	}
}
