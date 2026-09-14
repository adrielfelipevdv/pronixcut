import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Starts a Veo video generation job through Gemini's long-running video API.
// The user's own Gemini key is used and never persisted server-side — same
// pattern as generate-image/route.ts. Veo jobs run for tens of seconds to a
// few minutes, so this only *starts* the job; the client polls
// /api/pronix-editor/video-status with the returned operation name.

const requestSchema = z.object({
	apiKey: z.string().min(1),
	prompt: z.string().min(1),
	aspectRatio: z.enum(["16:9", "9:16"]).default("16:9"),
});

const MODEL = "veo-3.0-generate-001";

export async function POST(request: NextRequest) {
	const body = await request.json();
	const result = requestSchema.safeParse(body);
	if (!result.success) {
		return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
	}
	const { apiKey, prompt, aspectRatio } = result.data;

	try {
		const response = await fetch(
			`https://generativelanguage.googleapis.com/v1beta/models/${MODEL}:predictLongRunning?key=${apiKey}`,
			{
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({
					instances: [{ prompt }],
					parameters: { aspectRatio },
				}),
			},
		);

		const data = await response.json();
		if (!response.ok) {
			return NextResponse.json(
				{ error: data.error?.message ?? "Falha ao iniciar a geração de vídeo." },
				{ status: response.status },
			);
		}

		if (!data.name) {
			return NextResponse.json(
				{ error: "A API não retornou um identificador de operação." },
				{ status: 502 },
			);
		}

		return NextResponse.json({ operationName: data.name });
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Falha ao iniciar a geração de vídeo." },
			{ status: 502 },
		);
	}
}
