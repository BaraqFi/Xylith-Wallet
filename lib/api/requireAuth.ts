import { NextRequest, NextResponse } from "next/server";
import { verifyPrivyToken } from "@/lib/ai/privyServer";

/**
 * Route guard: returns a 401 response if the request lacks a valid Privy access
 * token, or null if authenticated. Use at the top of any route that spends our
 * API keys or acts on a user's behalf:
 *
 *   const unauth = await requireAuth(req);
 *   if (unauth) return unauth;
 *
 * Rate limiting is layered on top of this in Phase R (Redis-backed).
 */
export async function requireAuth(req: NextRequest): Promise<NextResponse | null> {
  const userId = await verifyPrivyToken(req);
  if (!userId) {
    return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
  }
  return null;
}
