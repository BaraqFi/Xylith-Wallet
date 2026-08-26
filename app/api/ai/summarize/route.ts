import { NextRequest, NextResponse } from "next/server";
import { requireAuth } from "@/lib/api/requireAuth";
import { rateLimit } from "@/lib/api/rateLimit";
import { summarizeHistory } from "@/lib/ai/geminiService";
import type { Transaction } from "@/lib/ai/types";
import { assertAiEnv } from "@/lib/ai/env";

export const runtime = "nodejs";

type SummarizeBody = {
  history?: Transaction[];
};

export async function POST(req: NextRequest) {
    const unauth = await requireAuth(req);
    if (unauth) return unauth;
    const limited = await rateLimit(req, { limit: 20, windowSec: 60 });
    if (limited) return limited;
  try {
    assertAiEnv();

    const body = (await req.json()) as SummarizeBody;
    const history = body.history;

    if (!Array.isArray(history)) {
      return NextResponse.json({ error: "Invalid history" }, { status: 400 });
    }

    const summary = await summarizeHistory(history);
    return NextResponse.json({ summary });
  } catch (error) {
    console.error("AI Summarize Proxy Error:", error);
    return NextResponse.json(
      { error: "Failed to summarize history" },
      { status: 500 }
    );
  }
}

