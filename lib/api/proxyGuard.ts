import { NextRequest, NextResponse } from "next/server";
import { checkOrigin } from "./checkOrigin";
import { rateLimit } from "./rateLimit";

/**
 * Combined guard for provider-proxy routes: same-origin check + per-IP rate limit.
 * Both layers no-op safely (origin allows same-origin/SSR; rate limit fails open
 * without Redis), so callers are unaffected until Redis is configured.
 *
 * Default budget: 60 requests / minute / IP / route path.
 */
export async function proxyGuard(req: NextRequest): Promise<NextResponse | null> {
  const origin = checkOrigin(req);
  if (origin) return origin;
  return rateLimit(req, { limit: 60, windowSec: 60 });
}
