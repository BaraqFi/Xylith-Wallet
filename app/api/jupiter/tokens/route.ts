import { NextRequest, NextResponse } from "next/server";
import { proxyGuard } from "@/lib/api/proxyGuard";
import { cachedJson } from "@/lib/api/responseCache";

interface JupiterToken {
    id: string;
    symbol: string;
    name: string;
    decimals: number;
    mcap?: number;
    icon?: string;
}

// Jupiter Lite API V2 Base URL
const JUPITER_V2_API = "https://lite-api.jup.ag/tokens/v2";

function isSafeQuery(query: string): boolean {
  if (query.length < 2 || query.length > 64) return false;
  // Allow common search characters: letters, numbers, spaces, and a few symbols
  return /^[a-zA-Z0-9\s._\-/$]+$/.test(query);
}

export async function GET(req: NextRequest) {
    const blocked = await proxyGuard(req);
    if (blocked) return blocked;
  const searchParams = req.nextUrl.searchParams;
  const query = searchParams.get("query");

  try {
    let tokens: JupiterToken[] = [];

    if (query) {
      if (!isSafeQuery(query)) {
        return NextResponse.json(
          { error: "Invalid query parameter" },
          { status: 400 }
        );
      }

      // Search Mode — shared 5-minute cache, so a popular query is fetched once
      // for everyone rather than once per user.
      tokens = await cachedJson<JupiterToken[]>(
        `jupiter:search:${query.toLowerCase()}`,
        5 * 60,
        async () => {
          const response = await fetch(
            `${JUPITER_V2_API}/search?query=${encodeURIComponent(query)}&limit=20`,
            { headers: { Accept: "application/json" } },
          );
          if (!response.ok) {
            throw new Error(`Jupiter Search API error: ${response.status}`);
          }
          return response.json();
        },
      );
    } else {
      // Default Mode: Top Verified Tokens. Shared 24h cache — the verified list
      // barely moves, and every user pulling it fresh is wasted upstream load.
      const allTokens = await cachedJson<JupiterToken[]>(
        "jupiter:tokens:verified",
        24 * 60 * 60,
        async () => {
          const response = await fetch(`${JUPITER_V2_API}/tag?query=verified`, {
            headers: { Accept: "application/json" },
          });
          if (!response.ok) {
            throw new Error(`Jupiter Tag API error: ${response.status}`);
          }
          return response.json();
        },
      );

      // Filter and Sort
      tokens = allTokens
        .sort((a, b) => (b.mcap || 0) - (a.mcap || 0))
        .slice(0, 30);
    }

    // Map to standard Token interface with basic validation
    const mappedTokens = tokens
      .filter(
        (t): t is JupiterToken =>
          !!(t &&
          typeof t.id === "string" &&
          typeof t.symbol === "string" &&
          typeof t.name === "string" &&
          typeof t.decimals === "number")
      )
      .map((t) => ({
        address: t.id,
        symbol: t.symbol,
        name: t.name,
        decimals: t.decimals,
        logoURI:
          typeof t.icon === "string" && t.icon.length > 0
            ? t.icon
            : "https://tokens.1inch.io/0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee.png",
      }));

    return NextResponse.json(mappedTokens);
  } catch (error: unknown) {
    console.error("Error fetching Jupiter token list:", error);
    return NextResponse.json(
      {
        error: "Failed to fetch token list",
      },
      { status: 500 }
    );
  }
}
