import { NextRequest, NextResponse } from "next/server";
import { getTokenAnalytics } from "@/lib/services/tokenAnalyticsService";

/**
 * Server-side API route for token analytics
 * Prevents API key exposure and provides caching
 */
export async function GET(req: NextRequest) {
  const searchParams = req.nextUrl.searchParams;
  const symbol = searchParams.get("symbol");
  const chain = searchParams.get("chain");
  const contractAddress = searchParams.get("contractAddress");

  if (!symbol || !chain) {
    return NextResponse.json(
      { error: "Missing symbol or chain" },
      { status: 400 }
    );
  }

  try {
    const analytics = await getTokenAnalytics(
      symbol,
      chain as any,
      contractAddress || undefined
    );

    if (!analytics) {
      return NextResponse.json(
        { analytics: null },
        { status: 200 }
      );
    }

    return NextResponse.json(
      { analytics },
      {
        headers: {
          "Cache-Control": "public, s-maxage=300, stale-while-revalidate=600",
        },
      }
    );
  } catch (error: any) {
    console.error("Error fetching token analytics:", error);
    return NextResponse.json(
      { error: "Failed to fetch token analytics" },
      { status: 500 }
    );
  }
}
