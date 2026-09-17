import { Ratelimit } from "@upstash/ratelimit";
import { Redis } from "@upstash/redis";
import { webEnv } from "@/env/web";

// No Redis configured (e.g. the desktop build) → skip rate limiting instead
// of throwing at module load.
const baseRateLimit =
	webEnv.UPSTASH_REDIS_REST_URL && webEnv.UPSTASH_REDIS_REST_TOKEN
		? new Ratelimit({
				redis: new Redis({
					url: webEnv.UPSTASH_REDIS_REST_URL,
					token: webEnv.UPSTASH_REDIS_REST_TOKEN,
				}),
				limiter: Ratelimit.slidingWindow(100, "1 m"), // 100 requests per minute
				analytics: true,
				prefix: "rate-limit",
			})
		: null;

export async function checkRateLimit({ request }: { request: Request }) {
	if (!baseRateLimit) {
		return { success: true, limited: false };
	}

	const ip = request.headers.get("x-forwarded-for") ?? "anonymous";
	const { success } = await baseRateLimit.limit(ip);
	return { success, limited: !success };
}
