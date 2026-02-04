import { NextRequest, NextResponse } from "next/server";
import { analyzeApprovalRisk } from "@/lib/services/securityService";
import { Address, isAddress } from "viem";

function parseBigIntInput(value: unknown): bigint | null {
  if (typeof value !== "string" || !/^\d+$/.test(value)) {
    return null;
  }

  try {
    return BigInt(value);
  } catch {
    return null;
  }
}

/**
 * Server-side API route for approval security analysis
 */
export async function POST(req: NextRequest) {
  try {
    const { approvalAmount, tokenBalance, spenderAddress } = await req.json();

    if (approvalAmount == null || tokenBalance == null || !spenderAddress) {
      return NextResponse.json(
        { error: "Missing approvalAmount, tokenBalance, or spenderAddress" },
        { status: 400 }
      );
    }

    if (!isAddress(spenderAddress)) {
      return NextResponse.json(
        { error: "Invalid spenderAddress format" },
        { status: 400 }
      );
    }

    const approvalAmountBigInt = parseBigIntInput(
      approvalAmount
    );
    const tokenBalanceBigInt = parseBigIntInput(tokenBalance);

    if (approvalAmountBigInt === null || tokenBalanceBigInt === null) {
      return NextResponse.json(
        { error: "approvalAmount and tokenBalance must be decimal strings" },
        { status: 400 }
      );
    }

    const analysis = analyzeApprovalRisk(
      approvalAmountBigInt,
      tokenBalanceBigInt,
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
  } catch (error: unknown) {
    console.error("Error analyzing approval security:", error);
    return NextResponse.json(
      { error: "Failed to analyze approval security" },
      { status: 500 }
    );
  }
}
