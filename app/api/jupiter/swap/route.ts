import { NextRequest, NextResponse } from "next/server";

export async function POST(req: NextRequest) {
    try {
        const body = await req.json();
        const { quoteResponse, userPublicKey, wrapAndUnwrapSol } = body;

        if (!quoteResponse || !userPublicKey) {
            return NextResponse.json(
                { error: "Missing required parameters: quoteResponse, userPublicKey" },
                { status: 400 }
            );
        }

        const apiKey = process.env.JUPITER_API_KEY;
        if (!apiKey) {
            return NextResponse.json(
                { error: "Server misconfiguration: No API Key" },
                { status: 500 }
            );
        }

        // Jupiter Swap API v6
        const url = "https://quote-api.jup.ag/v6/swap";

        const res = await fetch(url, {
            method: "POST",
            headers: {
                "x-api-key": apiKey,
                "Content-Type": "application/json",
                Accept: "application/json",
            },
            body: JSON.stringify({
                quoteResponse,
                userPublicKey,
                wrapAndUnwrapSol: wrapAndUnwrapSol ?? true,
            }),
            // Do not cache swap transaction, it is time-sensitive
            cache: "no-store",
        });

        const data = await res.json();

        if (!res.ok) {
            return NextResponse.json(data, { status: res.status });
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("Jupiter Swap Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
