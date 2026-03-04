import { NextRequest, NextResponse } from "next/server";
import { getTokenAnalytics } from "@/lib/services/tokenAnalyticsService";
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

export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");
  const chainRaw = searchParams.get("chain");
  const contractAddress = searchParams.get("contractAddress");

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

  if (contractAddress && !isValidContractAddress(contractAddress)) {
    return NextResponse.json(
      { error: "Invalid contractAddress format" },
      { status: 400 }
    );
  }

  try {
    const analytics = await getTokenAnalytics(
      symbol,
      chainRaw as EVMChain | "solana",
      contractAddress || undefined
    );

    if (!analytics) {
      return NextResponse.json({ analytics: null }, { status: 200 });
    }

    return NextResponse.json(
      { analytics },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error: unknown) {
    console.error("Error fetching token analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch token analytics" },
      { status: 500 }
    );
  }
}
