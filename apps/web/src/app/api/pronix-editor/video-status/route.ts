import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Polls a Veo long-running operation started by generate-video/route.ts.
// Once done, downloads the resulting video server-side (the file URI needs
// the API key as a query param, which must never reach the browser) and
// returns it as a data URL for the client to preview / add to the library.

const requestSchema = z.object({
	apiKey: z.string().min(1),
	operationName: z.string().min(1),
});

const MAX_BYTES = 100 * 1024 * 1024; // 100MB safety cap for generated clips

export async function POST(request: NextRequest) {
	const body = await request.json();
	const result = requestSchema.safeParse(body);
	if (!result.success) {
		return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
	}
	const { apiKey, operationName } = result.data;

	try {
		const opResponse = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/${operationName}?key=${apiKey}`,
		);
		const op = await opResponse.json();
		if (!opResponse.ok) {
			return NextResponse.json(
				{ error: op.error?.message ?? "Falha ao consultar o status da geração." },
				{ status: opResponse.status },
			);
		}

		if (!op.done) {
			return NextResponse.json({ done: false });
		}

		if (op.error) {
			return NextResponse.json(
				{ error: op.error.message ?? "A geração de vídeo falhou." },
				{ status: 502 },
			);
		}

		const sample = op.response?.generateVideoResponse?.generatedSamples?.[0];
		const fileUri: string | undefined = sample?.video?.uri;
		if (!fileUri) {
			return NextResponse.json(
				{ error: "A operação terminou mas não retornou um vídeo." },
				{ status: 502 },
			);
		}

		const separator = fileUri.includes("?") ? "&" : "?";
		const videoResponse = await fetch(`${fileUri}${separator}key=${apiKey}`);
		if (!videoResponse.ok) {
			return NextResponse.json(
				{ error: `Falha ao baixar o vídeo gerado (${videoResponse.status})` },
				{ status: 502 },
			);
		}

		const buffer = Buffer.from(await videoResponse.arrayBuffer());
		if (buffer.byteLength > MAX_BYTES) {
			return NextResponse.json(
				{ error: "Vídeo gerado excede o limite de 100MB." },
				{ status: 413 },
			);
		}

		const mimeType = videoResponse.headers.get("content-type") ?? "video/mp4";
		return NextResponse.json({
			done: true,
			dataUrl: `data:${mimeType};base64,${buffer.toString("base64")}`,
			mimeType,
		});
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Falha ao consultar a geração de vídeo." },
			{ status: 502 },
		);
	}
}
