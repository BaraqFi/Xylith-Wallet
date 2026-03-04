import { NextRequest, NextResponse } from "next/server";
import { analyzeSwapRouteRisk } from "@/lib/services/securityService";

function parseSlippage(value: unknown): number | null {
  if (typeof value !== "number" && typeof value !== "string") return null;
  const num = typeof value === "number" ? value : Number(value);
  if (!Number.isFinite(num)) return null;
  // Acceptable range: 0 < slippage <= 0.5 (0% - 50%)
  if (num <= 0 || num > 0.5) return null;
  return num;
}

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

    const parsedSlippage = parseSlippage(slippage);
    if (parsedSlippage === null) {
      return NextResponse.json(
        { error: "Invalid slippage value; must be between 0 and 0.5" },
        { status: 400 }
      );
    }

    const analysis = analyzeSwapRouteRisk(quote, parsedSlippage);

    return NextResponse.json({ analysis });
  } catch (error: unknown) {
    console.error("Error analyzing swap route security:", error);
    return NextResponse.json(
      { error: "Failed to analyze swap route security" },
      { status: 500 }
    );
  }
}
