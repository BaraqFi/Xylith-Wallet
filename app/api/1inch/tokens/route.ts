import { NextRequest, NextResponse } from "next/server";
import { proxyGuard } from "@/lib/api/proxyGuard";
import { cachedJson } from "@/lib/api/responseCache";

/**
 * Proxy + shared cache for the 1inch public token list.
 *
 * Previously the browser fetched `tokens.1inch.io` directly on load, so every user
 * pulled the full list fresh. This route serves it from a shared 24h Redis cache
 * (first user populates it) and keeps the fetch same-origin + rate-limited.
 */
export async function GET(req: NextRequest) {
  const blocked = await proxyGuard(req);
  if (blocked) return blocked;

  const chainId = req.nextUrl.searchParams.get("chainId");
  if (!chainId || !/^\d{1,7}$/.test(chainId)) {
    return NextResponse.json({ error: "Invalid chainId" }, { status: 400 });
  }

  try {
    const data = await cachedJson(`1inch:tokens:${chainId}`, 24 * 60 * 60, async () => {
      const res = await fetch(`https://tokens.1inch.io/v1.1/${chainId}`, {
        next: { revalidate: 86400 },
      });
      if (!res.ok) {
        throw new Error(`1inch token list error: ${res.status}`);
      }
      return res.json();
    });
    return NextResponse.json(data);
  } catch (error) {
    console.error("1inch tokens proxy error:", error);
    return NextResponse.json({ error: "Failed to fetch token list" }, { status: 502 });
  }
}
