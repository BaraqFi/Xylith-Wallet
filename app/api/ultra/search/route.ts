import { NextRequest, NextResponse } from "next/server";

interface UltraToken {
    mint: string;
    symbol: string;
    name: string;
    decimals: number;
    icon?: string;
}

function isSafeQuery(query: string): boolean {
    if (query.length < 2 || query.length > 64) return false;
    // Allow common search characters: letters, numbers, spaces, and a few symbols
    return /^[a-zA-Z0-9\s._\-/$]+$/.test(query);
}

export async function GET(req: NextRequest) {
    const searchParams = req.nextUrl.searchParams;
    const query = searchParams.get("query");

    if (!query) {
        return NextResponse.json(
            { error: "Missing query parameter" },
            { status: 400 },
        );
    }

    if (!isSafeQuery(query)) {
        return NextResponse.json(
            { error: "Invalid query parameter" },
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
            `https://api.jup.ag/ultra/v1/search?query=${encodeURIComponent(query)}`,
            {
                headers: {
                    "x-api-key": apiKey,
                    Accept: "application/json",
                },
                next: { revalidate: 60 },
            },
        );

        if (!response.ok) {
            const errorBody = await response.json().catch(() => ({}));
            return NextResponse.json(errorBody, { status: response.status });
        }

        const tokens = await response.json();

        if (!Array.isArray(tokens)) {
            return NextResponse.json(
                { error: "Unexpected search response format" },
                { status: 502 },
            );
        }

        const mappedTokens = tokens
            .filter(
                (t): t is UltraToken =>
                    !!(t &&
                    typeof t.mint === "string" &&
                    typeof t.symbol === "string" &&
                    typeof t.name === "string" &&
                    typeof t.decimals === "number"),
            )
            .map((t: UltraToken) => ({
                address: t.mint,
                symbol: t.symbol,
                name: t.name,
                decimals: t.decimals,
                logoURI:
                    typeof t.icon === "string" && t.icon.length > 0
                        ? t.icon
                        : undefined,
            }));

        return NextResponse.json(mappedTokens);
    } catch (error) {
        console.error("Ultra Search Error:", error);
        return NextResponse.json(
            { error: "Failed to search tokens" },
            { status: 500 },
        );
    }
}

