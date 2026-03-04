import { NextRequest, NextResponse } from "next/server";

const SOLANA_ADDRESS_REGEX = /^[1-9A-HJ-NP-Za-km-z]{32,44}$/;

function isValidSolanaAddress(address: string | null): address is string {
    return !!address && SOLANA_ADDRESS_REGEX.test(address);
}

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const address = searchParams.get("address");

    if (!isValidSolanaAddress(address)) {
        return NextResponse.json(
            { error: "Invalid or missing Solana address" },
            { status: 400 },
        );
    }

    const apiKey =
        process.env.ULTRA_API_KEY || process.env.JUPITER_API_KEY || null;
    if (!apiKey) {
        return NextResponse.json(
            { error: "Server misconfiguration: No API Key" },
            { status: 500 },
        );
    }

    try {
        const response = await fetch(
            `https://api.jup.ag/ultra/v1/holdings/${address}`,
            {
                headers: {
                    "x-api-key": apiKey,
                    Accept: "application/json",
                },
                // Holdings can be cached briefly to reduce load
                next: { revalidate: 15 },
            },
        );

        const data = await response.json();

        if (!response.ok) {
            return NextResponse.json(data, { status: response.status });
        }

        // Basic shape validation
        const amount = typeof data.amount === "string" ? data.amount : "0";
        const uiAmount =
            typeof data.uiAmount === "number" ? data.uiAmount : 0;
        const uiAmountString =
            typeof data.uiAmountString === "string"
                ? data.uiAmountString
                : "0";
        const tokens =
            data.tokens && typeof data.tokens === "object" ? data.tokens : {};

        return NextResponse.json({
            amount,
            uiAmount,
            uiAmountString,
            tokens,
        });
    } catch (error) {
        console.error("Ultra Holdings Error:", error);
        return NextResponse.json(
            { error: "Failed to fetch holdings" },
            { status: 500 },
        );
    }
}

