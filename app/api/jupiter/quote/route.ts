import { NextRequest, NextResponse } from "next/server";

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const inputMint = searchParams.get("inputMint");
    const outputMint = searchParams.get("outputMint");
    const amount = searchParams.get("amount");
    const slippageBps = searchParams.get("slippageBps");

    if (!inputMint || !outputMint || !amount) {
        return NextResponse.json(
            { error: "Missing required parameters: inputMint, outputMint, amount" },
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

    // Jupiter Quote API v6
    const url = new URL("https://quote-api.jup.ag/v6/quote");
    url.searchParams.append("inputMint", inputMint);
    url.searchParams.append("outputMint", outputMint);
    url.searchParams.append("amount", amount);
    if (slippageBps) {
        url.searchParams.append("slippageBps", slippageBps);
    }

    try {
        const res = await fetch(url.toString(), {
            headers: {
                "x-api-key": apiKey,
                "Content-Type": "application/json",
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
        console.error("Jupiter Quote Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
