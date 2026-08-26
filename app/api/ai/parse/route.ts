import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/requireAuth";
import { rateLimit } from "@/lib/api/rateLimit";
import { parseUserCommand } from "@/lib/ai/geminiService";
import { assertAiEnv } from "@/lib/ai/env";

export const runtime = "nodejs";

type ParseBody = {
  userText?: string;
  wallet?: { evmAddress?: string; solAddress?: string };
};

export async function POST(req: NextRequest) {
    const unauth = await requireAuth(req);
    if (unauth) return unauth;
    const limited = await rateLimit(req, { limit: 20, windowSec: 60 });
    if (limited) return limited;
  try {
    assertAiEnv();

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

