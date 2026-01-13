import { NextRequest, NextResponse } from "next/server";
import { getTokenPriceHistory } from "@/lib/services/tokenAnalyticsService";

/**
 * Server-side API route for token price history
 * Prevents API key exposure and provides caching
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");
  const chain = searchParams.get("chain");
  const contractAddress = searchParams.get("contractAddress");
  const days = parseInt(searchParams.get("days") || "7", 10);

  if (!symbol || !chain) {
    return NextResponse.json(
      { error: "Missing symbol or chain" },
      { status: 400 }
    );
  }

  try {
    const history = await getTokenPriceHistory(
      symbol,
      chain as any,
      contractAddress || undefined,
      days
    );

    if (!history) {
      return NextResponse.json(
        { history: null },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { history },
      {
        headers: {
          "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=7200",
        },
      }
    );
  } catch (error: any) {
    console.error("Error fetching token price history:", error);
    return NextResponse.json(
      { error: "Failed to fetch token price history" },
      { status: 500 }
    );
  }
}
