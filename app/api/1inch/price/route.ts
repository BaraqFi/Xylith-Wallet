import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const chainId = searchParams.get("chainId");

    if (!chainId) {
        return NextResponse.json({ error: "Missing chainId" }, { status: 400 });
    }

    const apiKey = process.env.ONE_INCH_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "Server misconfiguration: No API Key" }, { status: 500 });
    }

    // 1inch Spot Price API v1.2
    const url = `https://api.1inch.dev/price/v1.1/${chainId}`;

    try {
        const body = await req.json();

        // Validate that 'tokens' array exists in body
        if (!body.tokens || !Array.isArray(body.tokens)) {
            return NextResponse.json({ error: "Missing tokens array in body" }, { status: 400 });
        }

        const res = await fetch(url, {
            method: "POST",
            headers: {
                Authorization: `Bearer ${apiKey}`,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify(body),
            next: { revalidate: 60 }, // Cache prices for 60 seconds
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json(data, { status: res.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("1inch Price Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
