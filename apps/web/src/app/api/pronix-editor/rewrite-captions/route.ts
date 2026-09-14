import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Ported from the original PronixEditor's "IA na legenda numa passada só"
// (Integrations tab) — sends the caption block texts to the user's own
// configured LLM and asks it to clean them up (fix filler words/grammar,
// fix casing) while strictly preserving the number and order of lines, since
// each line maps 1:1 to a timed block on the timeline.

const requestSchema = z.object({
	provider: z.enum(["openai", "gemini", "anthropic"]),
	apiKey: z.string().min(1, "API key is required"),
	texts: z.array(z.string()).min(1),
});

const SYSTEM_PROMPT =
	"Você corrige transcrições de legendas de vídeo em português do Brasil. " +
	"Corrija erros gramaticais, remova vícios de linguagem (tipo, né, então, ãh) " +
	"e ajuste a pontuação/capitalização, mas preserve o sentido e o tom original. " +
	"NÃO junte, divida, reordene ou remova linhas — a resposta deve ter exatamente " +
	"o mesmo número de linhas que a entrada, uma correção por linha, na mesma ordem. " +
	"Responda APENAS com um JSON no formato {\"texts\": [\"...\", \"...\"]}, sem texto extra.";

function extractJsonTexts(raw: string): string[] {
	const match = raw.match(/\{[\s\S]*\}/);
	const jsonText = match ? match[0] : raw;
	const parsed = JSON.parse(jsonText);
	if (!Array.isArray(parsed.texts)) {
		throw new Error("Resposta da IA não continha um array 'texts'.");
	}
	return parsed.texts.map((t: unknown) => String(t));
}

async function rewriteWithOpenAI({
	apiKey,
	texts,
}: {
	apiKey: string;
	texts: string[];
}): Promise<string[]> {
	const response = await fetch("https://api.openai.com/v1/chat/completions", {
		method: "POST",
		headers: {
			Authorization: `Bearer ${apiKey}`,
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: "gpt-4o-mini",
			messages: [
				{ role: "system", content: SYSTEM_PROMPT },
				{ role: "user", content: JSON.stringify({ texts }) },
			],
			response_format: { type: "json_object" },
		}),
	});

	if (!response.ok) {
		const errorBody = await response.json().catch(() => null);
		throw new Error(errorBody?.error?.message ?? `OpenAI request failed (${response.status})`);
	}

	const body = await response.json();
	return extractJsonTexts(body.choices?.[0]?.message?.content ?? "");
}

async function rewriteWithAnthropic({
	apiKey,
	texts,
}: {
	apiKey: string;
	texts: string[];
}): Promise<string[]> {
	const response = await fetch("https://api.anthropic.com/v1/messages", {
		method: "POST",
		headers: {
			"x-api-key": apiKey,
			"anthropic-version": "2023-06-01",
			"Content-Type": "application/json",
		},
		body: JSON.stringify({
			model: "claude-haiku-4-5-20251001",
			max_tokens: 4096,
			system: SYSTEM_PROMPT,
			messages: [{ role: "user", content: JSON.stringify({ texts }) }],
		}),
	});

	if (!response.ok) {
		const errorBody = await response.json().catch(() => null);
		throw new Error(errorBody?.error?.message ?? `Anthropic request failed (${response.status})`);
	}

	const body = await response.json();
	const textBlock = body.content?.find((block: { type: string }) => block.type === "text");
	return extractJsonTexts(textBlock?.text ?? "");
}

async function rewriteWithGemini({
	apiKey,
	texts,
}: {
	apiKey: string;
	texts: string[];
}): Promise<string[]> {
	const model = "gemini-2.5-flash";
	const response = await fetch(
		`https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${apiKey}`,
		{
			method: "POST",
			headers: { "Content-Type": "application/json" },
			body: JSON.stringify({
				systemInstruction: { parts: [{ text: SYSTEM_PROMPT }] },
				contents: [{ parts: [{ text: JSON.stringify({ texts }) }] }],
				generationConfig: { responseMimeType: "application/json" },
			}),
		},
	);

	if (!response.ok) {
		const errorBody = await response.json().catch(() => null);
		throw new Error(errorBody?.error?.message ?? `Gemini request failed (${response.status})`);
	}

	const body = await response.json();
	const text = body.candidates?.[0]?.content?.parts?.[0]?.text ?? "";
	return extractJsonTexts(text);
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

	const { provider, apiKey, texts } = result.data;

	try {
		const rewritten =
			provider === "openai"
				? await rewriteWithOpenAI({ apiKey, texts })
				: provider === "anthropic"
					? await rewriteWithAnthropic({ apiKey, texts })
					: await rewriteWithGemini({ apiKey, texts });

		if (rewritten.length !== texts.length) {
			return NextResponse.json(
				{
					error: `A IA retornou ${rewritten.length} linha(s), mas eram esperadas ${texts.length}.`,
				},
				{ status: 502 },
			);
		}

		return NextResponse.json({ texts: rewritten });
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Falha ao corrigir legendas." },
			{ status: 502 },
		);
	}
}
