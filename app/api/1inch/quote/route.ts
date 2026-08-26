import { NextRequest, NextResponse } from "next/server";
import { proxyGuard } from "@/lib/api/proxyGuard";

export async function GET(req: NextRequest) {
    const blocked = await proxyGuard(req);
    if (blocked) return blocked;
    const searchParams = req.nextUrl.searchParams;
    const chainId = searchParams.get("chainId");

    if (!chainId) {
        return NextResponse.json({ error: "Missing chainId" }, { status: 400 });
    }

    const apiKey = process.env.ONE_INCH_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "Server misconfiguration: No API Key" }, { status: 500 });
    }

    // 1inch Swap API v6.0
    const url = `https://api.1inch.dev/swap/v6.0/${chainId}/quote?${searchParams.toString()}`;

    try {
        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: "application/json",
            },
            // Cache for 10 seconds to avoid hitting rate limits too fast on same duplicate requests
            next: { revalidate: 10 },
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json(data, { status: res.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("1inch Quote Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
