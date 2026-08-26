import { NextRequest, NextResponse } from "next/server";
import { isRedisConfigured, redisIncrWithTtl } from "@/lib/redis/client";

function clientIp(req: NextRequest): string {
  const xff = req.headers.get("x-forwarded-for");
  if (xff) return xff.split(",")[0].trim();
  return req.headers.get("x-real-ip") || "unknown";
}

export type RateLimitOptions = {
  /** Max requests allowed within the window. */
  limit: number;
  /** Window length in seconds. */
  windowSec: number;
  /** Optional explicit bucket key; defaults to `<path>:<ip>`. */
  key?: string;
};

/**
 * Fixed-window rate limiter backed by Redis. Returns a 429 response when the caller
 * exceeds the limit, else null.
 *
 * Fails OPEN: if Redis is not configured or a Redis call errors, requests are
 * allowed. This keeps the app fully functional without Redis while providing real,
 * cross-instance throttling once it is configured.
 */
export async function rateLimit(
  req: NextRequest,
  opts: RateLimitOptions,
): Promise<NextResponse | null> {
  if (!isRedisConfigured()) return null;

  const bucket = opts.key ?? `${req.nextUrl.pathname}:${clientIp(req)}`;
  const count = await redisIncrWithTtl(`ratelimit:${bucket}`, opts.windowSec);
  if (count === null) return null; // Redis error -> fail open

  if (count > opts.limit) {
    return NextResponse.json(
      { error: "Too many requests — please slow down and try again shortly." },
      { status: 429, headers: { "Retry-After": String(opts.windowSec) } },
    );
  }
  return null;
}
