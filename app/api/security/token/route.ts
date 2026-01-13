import { NextRequest, NextResponse } from "next/server";
import { analyzeTokenRisk } from "@/lib/services/securityService";
import { Address } from "viem";

/**
 * Server-side API route for token security analysis
 */
export async function POST(req: NextRequest) {
  try {
    const { contractAddress, chain } = await req.json();

    if (!contractAddress || !chain) {
      return NextResponse.json(
        { error: "Missing contractAddress or chain" },
        { status: 400 }
      );
    }

    const analysis = await analyzeTokenRisk(contractAddress as Address, chain);

    return NextResponse.json({ analysis });
  } catch (error: any) {
    console.error("Error analyzing token security:", error);
    return NextResponse.json(
      { error: "Failed to analyze token security" },
      { status: 500 }
    );
  }
}
