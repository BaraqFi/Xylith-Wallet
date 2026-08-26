
import { NextRequest, NextResponse } from "next/server";
import { proxyGuard } from "@/lib/api/proxyGuard";
import { getTokenPricesBatch } from "@/lib/services/tokenAnalyticsService";

export async function POST(req: NextRequest) {
    const blocked = await proxyGuard(req);
    if (blocked) return blocked;
    try {
        const body = await req.json();
        const { tokens, currency } = body;

        if (!tokens || !Array.isArray(tokens)) {
            return NextResponse.json(
                { error: "Invalid tokens array" },
                { status: 400 }
            );
        }

        // Call the service (which runs server-side here)
        // Ensure we pass only necessary data
        const prices = await getTokenPricesBatch(tokens, currency || "usd");

        return NextResponse.json(prices);
    } catch (error) {
        console.error("Price Batch Proxy Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch prices" },
            { status: 500 }
        );
    }
}
