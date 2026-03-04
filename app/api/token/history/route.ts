import { NextRequest, NextResponse } from "next/server";
import { getTokenPriceHistory } from "@/lib/services/tokenAnalyticsService";
import { isValidContractAddress } from "@/lib/services/tokenMetadataService";
import { EVMChain } from "@/components/wallet/data";

const ANALYTICS_CHAINS = new Set<EVMChain | "solana">([
  "ethereum",
  "base",
  "arbitrum",
  "optimism",
  "polygon",
  "bsc",
  "solana",
]);

function isValidSymbol(symbol: string | null): symbol is string {
  if (!symbol) return false;
  if (symbol.length === 0 || symbol.length > 20) return false;
  return /^[A-Za-z0-9._\-]+$/.test(symbol);
}

function parseDays(raw: string | null): number | null {
  const value = raw ?? "7";
  const n = Number.parseInt(value, 10);
  // Allow 1–365 days to avoid huge payloads
  if (!Number.isFinite(n) || n < 1 || n > 365) return null;
  return n;
}

/**
 * Server-side API route for token price history
 * Prevents API key exposure and provides caching
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");
  const chainRaw = searchParams.get("chain");
  const contractAddress = searchParams.get("contractAddress");
  const days = parseDays(searchParams.get("days"));

  if (!isValidSymbol(symbol)) {
    return NextResponse.json(
      { error: "Invalid or missing symbol" },
      { status: 400 }
    );
  }

  if (!chainRaw || !ANALYTICS_CHAINS.has(chainRaw as EVMChain | "solana")) {
    return NextResponse.json(
      { error: "Invalid or missing chain" },
      { status: 400 }
    );
  }

  if (days === null) {
    return NextResponse.json(
      { error: "Invalid days parameter; must be between 1 and 365" },
      { status: 400 }
    );
  }

  if (contractAddress && !isValidContractAddress(contractAddress)) {
    return NextResponse.json(
      { error: "Invalid contractAddress format" },
      { status: 400 }
    );
  }

  try {
    const history = await getTokenPriceHistory(
      symbol,
      chainRaw as EVMChain | "solana",
      contractAddress || undefined,
      days
    );

    if (!history) {
      return NextResponse.json({ history: null }, { status: 200 });
    }

    return NextResponse.json(
      { history },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      }
    );
  } catch (error: unknown) {
    console.error("Error fetching token price history:", error);
    return NextResponse.json(
      { error: "Failed to fetch token price history" },
      { status: 500 }
    );
  }
}
