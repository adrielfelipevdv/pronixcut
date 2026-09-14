import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Proxies image-generation requests to the provider the user configured with
// their own API key. Runs server-side only to avoid CORS (these provider
// APIs are not meant to be called directly from a browser) — the key never
// reaches this app's own persistence, it's forwarded per-request as sent by
// the client (which itself only keeps it in the user's local browser storage).

const ASPECT_RATIOS = ["1:1", "9:16", "16:9"] as const;

const requestSchema = z.object({
	provider: z.enum(["openai", "gemini"]),
	apiKey: z.string().min(1, "API key is required"),
	prompt: z.string().min(1, "Prompt is required").max(4000),
	aspectRatio: z.enum(ASPECT_RATIOS),
	n: z.number().int().min(1).max(4).optional().default(1),
});

interface GeneratedImage {
	dataUrl: string;
}

const OPENAI_SIZE_BY_ASPECT: Record<(typeof ASPECT_RATIOS)[number], string> = {
	"1:1": "1024x1024",
	"9:16": "1024x1536",
	"16:9": "1536x1024",
};

async function generateWithOpenAI({
	apiKey,
	prompt,
	aspectRatio,
	n,
}: {
	apiKey: string;
	prompt: string;
	aspectRatio: (typeof ASPECT_RATIOS)[number];
	n: number;
}): Promise<GeneratedImage[]> {
	const response = await fetch("https://api.openai.com/v1/images/generations", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: "gpt-image-1",
			prompt,
			size: OPENAI_SIZE_BY_ASPECT[aspectRatio],
			n,
		}),
	});

	if (!response.ok) {
		const errorBody = await response.json().catch(() => null);
		throw new Error(
			errorBody?.error?.message ?? `OpenAI request failed (${response.status})`,
		);
	}

	const body = await response.json();
	const images: GeneratedImage[] = [];

	for (const item of body.data ?? []) {
		if (item.b64_json) {
			images.push({ dataUrl: `data:image/png;base64,${item.b64_json}` });
		} else if (item.url) {
			const imageRes = await fetch(item.url);
			const buffer = Buffer.from(await imageRes.arrayBuffer());
			images.push({
				dataUrl: `data:image/png;base64,${buffer.toString("base64")}`,
			});
		}
	}

	return images;
}

async function generateOneWithGemini({
	apiKey,
	prompt,
	aspectRatio,
}: {
	apiKey: string;
	prompt: string;
	aspectRatio: (typeof ASPECT_RATIOS)[number];
}): Promise<GeneratedImage[]> {
	const model = "gemini-2.5-flash-image";
	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				contents: [
					{
						parts: [{ text: `${prompt} Proporção ${aspectRatio}.` }],
					},
				],
			}),
		},
	);

	if (!response.ok) {
		const errorBody = await response.json().catch(() => null);
		throw new Error(
			errorBody?.error?.message ?? `Gemini request failed (${response.status})`,
		);
	}

	const body = await response.json();
	const images: GeneratedImage[] = [];

	for (const candidate of body.candidates ?? []) {
		for (const part of candidate.content?.parts ?? []) {
			if (part.inlineData?.data) {
				const mimeType = part.inlineData.mimeType ?? "image/png";
				images.push({ dataUrl: `data:${mimeType};base64,${part.inlineData.data}` });
			}
		}
	}

	return images;
}

// Gemini's generateContent endpoint doesn't take a "how many" parameter the
// way OpenAI's images API does, so multiple variations means multiple
// independent requests run in parallel.
async function generateWithGemini({
	apiKey,
	prompt,
	aspectRatio,
	n,
}: {
	apiKey: string;
	prompt: string;
	aspectRatio: (typeof ASPECT_RATIOS)[number];
	n: number;
}): Promise<GeneratedImage[]> {
	const results = await Promise.all(
		Array.from({ length: n }, () => generateOneWithGemini({ apiKey, prompt, aspectRatio })),
	);
	return results.flat();
}

export async function POST(request: NextRequest) {
	const body = await request.json();
	const result = requestSchema.safeParse(body);

	if (!result.success) {
		return NextResponse.json(
			{ error: "Entrada inválida", details: result.error.flatten().fieldErrors },
			{ status: 400 },
		);
	}

	const { provider, apiKey, prompt, aspectRatio, n } = result.data;

	try {
		const images =
			provider === "openai"
				? await generateWithOpenAI({ apiKey, prompt, aspectRatio, n })
				: await generateWithGemini({ apiKey, prompt, aspectRatio, n });

		if (images.length === 0) {
			return NextResponse.json(
				{ error: "O provedor não retornou nenhuma imagem." },
				{ status: 502 },
			);
		}

		return NextResponse.json({ images });
	} catch (error) {
		return NextResponse.json(
			{
				error:
					error instanceof Error
						? error.message
						: "Falha ao gerar imagem.",
			},
			{ status: 502 },
		);
	}
}
