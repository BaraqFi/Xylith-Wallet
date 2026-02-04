import { NextRequest, NextResponse } from "next/server";
import { checkRecipientAddress } from "@/lib/services/securityService";
import { Address, isAddress } from "viem";

/**
 * Server-side API route for recipient address security check
 */
export async function POST(req: NextRequest) {
  try {
    const { address, chain } = await req.json();

    if (!address || !chain) {
      return NextResponse.json(
        { error: "Missing address or chain" },
        { status: 400 }
      );
    }

    if (!isAddress(address)) {
      return NextResponse.json(
        { error: "Invalid recipient address format" },
        { status: 400 }
      );
    }

    const result = await checkRecipientAddress(address as Address, chain);

    return NextResponse.json(result);
  } catch (error: unknown) {
    console.error("Error checking recipient address:", error);
    return NextResponse.json(
      { error: "Failed to check recipient address", isContract: false },
      { status: 500 }
    );
  }
}
