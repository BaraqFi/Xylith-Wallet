import { NextRequest, NextResponse } from "next/server";
import { analyzeApprovalRisk } from "@/lib/services/securityService";
import { Address } from "viem";

/**
 * Server-side API route for approval security analysis
 */
export async function POST(req: NextRequest) {
  try {
    const { approvalAmount, tokenBalance, spenderAddress } = await req.json();

    if (!approvalAmount || !tokenBalance || !spenderAddress) {
      return NextResponse.json(
        { error: "Missing approvalAmount, tokenBalance, or spenderAddress" },
        { status: 400 }
      );
    }

    const analysis = analyzeApprovalRisk(
      BigInt(approvalAmount),
      BigInt(tokenBalance),
      spenderAddress as Address
    );

    // Convert BigInt values to strings for JSON serialization
    return NextResponse.json({
      analysis: {
        ...analysis,
        approvalAmount: analysis.approvalAmount.toString(),
        tokenBalance: analysis.tokenBalance.toString(),
      },
    });
  } catch (error: any) {
    console.error("Error analyzing approval security:", error);
    return NextResponse.json(
      { error: "Failed to analyze approval security" },
      { status: 500 }
    );
  }
}
