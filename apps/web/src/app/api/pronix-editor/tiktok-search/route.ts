import { type NextRequest, NextResponse } from "next/server";
import { z } from "zod";

// Ported from the original PronixEditor's B-Roll AI reference search
// (engine/resolvepilot/broll/tiktok_search.py). Same third-party service
// (tiktokapi.store — a paid API specialized in this, not scraping), same
// endpoint/auth shape, same response normalization. The user's own API key
// is proxied server-side only, never exposed to the browser.

const requestSchema = z.object({
	apiKey: z.string().min(1),
	query: z.string().min(1),
	count: z.number().int().min(1).max(50).default(20),
});

const SEARCH_URL = "https://tiktokapi.store/api/v1/search/video";

interface TikTokVideo {
	video_id?: string | number;
	author?: { unique_id?: string; nickname?: string };
	cover?: string;
	play?: string;
	title?: string;
	play_count?: number;
	digg_count?: number;
}

function normalize(video: TikTokVideo) {
	if (!video.video_id) return null;
	const author = video.author ?? {};
	const handle = author.unique_id ?? "";
	return {
		id: String(video.video_id),
		link: handle
			? `https://www.tiktok.com/@${handle}/video/${video.video_id}`
			: `https://www.tiktok.com/video/${video.video_id}`,
		thumbnail: video.cover ?? null,
		videoUrl: video.play ?? null,
		desc: (video.title ?? "").trim(),
		author: author.nickname || handle || "",
		plays: video.play_count ?? 0,
		likes: video.digg_count ?? 0,
	};
}

export async function POST(request: NextRequest) {
	const body = await request.json();
	const result = requestSchema.safeParse(body);
	if (!result.success) {
		return NextResponse.json({ error: "Parâmetros inválidos" }, { status: 400 });
	}
	const { apiKey, query, count } = result.data;

	try {
		const response = await fetch(
			`${SEARCH_URL}?${new URLSearchParams({ search_term: query, count: String(count) })}`,
			{ headers: { Authorization: `Bearer ${apiKey}` } },
		);

		const text = await response.text();
		if (response.status >= 400) {
			return NextResponse.json(
				{ error: `Busca TikTok ${response.status}: ${text.slice(0, 300)}` },
				{ status: 502 },
			);
		}

		const parsed = JSON.parse(text);
		if (parsed.code) {
			return NextResponse.json(
				{ error: `Busca TikTok: ${parsed.msg || "erro desconhecido"}` },
				{ status: 502 },
			);
		}

		const videos: TikTokVideo[] = parsed.data?.videos ?? [];
		const results = videos.map(normalize).filter((v): v is NonNullable<typeof v> => v !== null);

		return NextResponse.json({ results });
	} catch (error) {
		return NextResponse.json(
			{ error: error instanceof Error ? error.message : "Falha ao buscar no TikTok." },
			{ status: 502 },
		);
	}
}
