import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const chainId = searchParams.get("chainId");
    const address = searchParams.get("address");

    if (!chainId) {
        return NextResponse.json({ error: "Missing chainId" }, { status: 400 });
    }
    if (!address) {
        return NextResponse.json({ error: "Missing address" }, { status: 400 });
    }

    const apiKey = process.env.ONE_INCH_API_KEY;
    if (!apiKey) {
        return NextResponse.json({ error: "Server misconfiguration: No API Key" }, { status: 500 });
    }

    // 1inch History API v2.0
    // Endpoint: https://api.1inch.dev/history/v2.0/transactions/{address}?chainId={chainId}
    // There are other valid params like limit, offset.

    // Clean params to forward
    const forwardParams = new URLSearchParams();
    searchParams.forEach((value, key) => {
        if (key !== "address" && key !== "chainId") {
            forwardParams.append(key, value);
        }
    });

    const url = `https://api.1inch.dev/history/v2.0/transactions/${address}?chainId=${chainId}&${forwardParams.toString()}`;

    try {
        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: "application/json",
            },
            next: { revalidate: 30 }, // Cache for 30 seconds
        });

        const data = await res.json();

        if (!res.ok) {
            // If 404, might just mean no history, but 1inch usually returns empty array?
            // Let's pass through status
            return NextResponse.json(data, { status: res.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("1inch History Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
