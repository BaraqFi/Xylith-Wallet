import { NextRequest, NextResponse } from "next/server";

function safeHost(u: string): string | null {
  try {
    return new URL(u).host;
  } catch {
    return null;
  }
}

/**
 * Lightweight same-origin guard for provider-proxy routes.
 *
 * Blocks requests whose Origin/Referer is a DIFFERENT host than the app (cross-site
 * browser abuse) while allowing same-origin browser calls and non-browser/SSR calls
 * that omit these headers (e.g. the Account Kit SDK transport, manual-wallet hooks).
 *
 * This is defense-in-depth only — it does not stop a non-browser client that omits
 * headers. Per-IP + per-user rate limiting (Phase R, Redis-backed) is the real bound
 * on API-key/quota abuse. Full Bearer auth on these proxies would require threading a
 * Privy token through every client hook and the SDK transport, which is deferred.
 */
export function checkOrigin(req: NextRequest): NextResponse | null {
  const host = req.headers.get("host");
  const origin = req.headers.get("origin");
  const referer = req.headers.get("referer");

  const sourceHost = origin ? safeHost(origin) : referer ? safeHost(referer) : null;

  // No Origin/Referer present -> allow (server-to-server / SDK transport / some GETs).
  if (!sourceHost) return null;
  // Same-origin -> allow.
  if (host && sourceHost === host) return null;

  return NextResponse.json({ error: "Forbidden" }, { status: 403 });
}
