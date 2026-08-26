import { isRedisConfigured, redisGet, redisSet } from "@/lib/redis/client";

/**
 * Read-through JSON cache for generic (non-user-specific) provider responses.
 *
 * The first caller populates the cache; subsequent callers read from Redis until
 * the TTL expires — so repeated app-load / page-switch calls do not each hit the
 * paid upstream. No-op passthrough when Redis is not configured.
 *
 * Only use for data that is identical across users (token lists, metadata, prices,
 * security info). Never use for per-address balances/history or session data.
 */
export async function cachedJson<T>(
  key: string,
  ttlSec: number,
  fetcher: () => Promise<T>,
): Promise<T> {
  if (isRedisConfigured()) {
    const hit = await redisGet(`cache:${key}`);
    if (hit) {
      try {
        return JSON.parse(hit) as T;
      } catch {
        // corrupt entry -> fall through and refetch
      }
    }
  }

  const value = await fetcher();

  if (isRedisConfigured() && value !== null && value !== undefined) {
    try {
      await redisSet(`cache:${key}`, JSON.stringify(value), ttlSec);
    } catch {
      // ignore cache write failures
    }
  }
  return value;
}
