import { NextRequest, NextResponse } from "next/server";
import { parseUserCommand } from "@/lib/ai/geminiService";

export const runtime = "nodejs";

type ParseBody = {
  userText?: string;
  wallet?: { evmAddress?: string; solAddress?: string };
};

export async function POST(req: NextRequest) {
  try {
    const body = (await req.json()) as ParseBody;
    const userText = body.userText?.trim();
    const evmAddress = body.wallet?.evmAddress?.trim();
    const solAddress = body.wallet?.solAddress?.trim();

    if (!userText) {
      return NextResponse.json({ error: "Missing userText" }, { status: 400 });
    }
    if (!evmAddress || !solAddress) {
      return NextResponse.json(
        { error: "Missing wallet addresses" },
        { status: 400 }
      );
    }

    const command = await parseUserCommand(userText, { evmAddress, solAddress });
    return NextResponse.json(command);
  } catch (error) {
    console.error("AI Parse Proxy Error:", error);
    return NextResponse.json(
      { error: "Failed to parse command" },
      { status: 500 }
    );
  }
}

