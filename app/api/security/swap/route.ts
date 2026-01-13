import { NextRequest, NextResponse } from "next/server";
import { analyzeSwapRouteRisk } from "@/lib/services/securityService";

/**
 * Server-side API route for swap route security analysis
 */
export async function POST(req: NextRequest) {
  try {
    const { quote, slippage } = await req.json();

    if (!quote || slippage === undefined) {
      return NextResponse.json(
        { error: "Missing quote or slippage" },
        { status: 400 }
      );
    }

    const analysis = analyzeSwapRouteRisk(quote, slippage);

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error("Error analyzing swap route security:", error);
    return NextResponse.json(
      { error: "Failed to analyze swap route security" },
      { status: 500 }
    );
  }
}
