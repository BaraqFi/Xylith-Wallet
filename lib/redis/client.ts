/**
 * Minimal Upstash Redis REST client (dependency-free).
 *
 * Uses the Upstash REST API over fetch, so it works in the Node.js serverless
 * runtime without a TCP connection or extra dependency. Every helper is a no-op /
 * null when Redis is not configured, so the app behaves exactly as before until
 * UPSTASH_REDIS_REST_URL + UPSTASH_REDIS_REST_TOKEN are set.
 */

const URL_ENV = process.env.UPSTASH_REDIS_REST_URL;
const TOKEN_ENV = process.env.UPSTASH_REDIS_REST_TOKEN;

export function isRedisConfigured(): boolean {
  return Boolean(URL_ENV && TOKEN_ENV);
}

/** Run a single Redis command via the REST API. Returns `result`, or null on any failure. */
async function command<T = unknown>(args: (string | number)[]): Promise<T | null> {
  if (!isRedisConfigured()) return null;
  try {
    const res = await fetch(URL_ENV as string, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${TOKEN_ENV}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(args),
      // Never cache Redis responses at the fetch layer.
      cache: "no-store",
      signal: AbortSignal.timeout(5000),
    });
    if (!res.ok) return null;
    const data = (await res.json()) as { result?: T; error?: string };
    if (data.error) return null;
    return (data.result ?? null) as T | null;
  } catch {
    return null;
  }
}

export async function redisGet(key: string): Promise<string | null> {
  return command<string>(["GET", key]);
}

export async function redisSet(
  key: string,
  value: string,
  ttlSec?: number,
): Promise<boolean> {
  const args: (string | number)[] = ["SET", key, value];
  if (ttlSec && ttlSec > 0) {
    args.push("EX", Math.floor(ttlSec));
  }
  const r = await command<string>(args);
  return r === "OK";
}

export async function redisDel(key: string): Promise<boolean> {
  const r = await command<number>(["DEL", key]);
  return typeof r === "number" && r >= 0;
}

/**
 * Increment a counter and ensure a TTL is set on first use. Returns the new count,
 * or null if Redis is unavailable (caller should fail open).
 */
export async function redisIncrWithTtl(
  key: string,
  windowSec: number,
): Promise<number | null> {
  const count = await command<number>(["INCR", key]);
  if (count === null) return null;
  if (count === 1) {
    // First hit in the window — set expiry.
    await command(["EXPIRE", key, Math.floor(windowSec)]);
  }
  return count;
}
