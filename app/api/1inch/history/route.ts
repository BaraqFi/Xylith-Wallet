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

    // 1inch History API endpoint format
    // Note: History API may require specific API key tier/access
    const url = `https://api.1inch.dev/history/v2.0/transactions/${address}?chainId=${chainId}&${forwardParams.toString()}`;

    try {
        const res = await fetch(url, {
            headers: {
                Authorization: `Bearer ${apiKey}`,
                Accept: "application/json",
            },
            next: { revalidate: 30 }, // Cache for 30 seconds
        });

        // Log the response for debugging
        console.log(`[1inch History API] Status: ${res.status}, URL: ${url}`);

        // Check if response has content before parsing JSON
        const contentType = res.headers.get("content-type");
        const text = await res.text();
        
        // Log response body for debugging (first 500 chars)
        if (!res.ok) {
            console.log(`[1inch History API] Error response: ${text.substring(0, 500)}`);
        }

        // If response is empty or not JSON, return empty array
        if (!text || !contentType?.includes("application/json")) {
            if (!res.ok) {
                // For non-200 status with empty response, return appropriate error
                return NextResponse.json(
                    { error: `1inch API error: ${res.status} ${res.statusText}` },
                    { status: res.status }
                );
            }
            // Empty but OK response - return empty array
            return NextResponse.json([]);
        }

        let data;
        try {
            data = JSON.parse(text);
        } catch (parseError) {
            console.error("1inch History JSON Parse Error:", parseError, "Response text:", text);
            // If JSON parse fails, return empty array for OK responses, error for non-OK
            if (!res.ok) {
                return NextResponse.json(
                    { error: "Invalid JSON response from 1inch API" },
                    { status: 500 }
                );
            }
            return NextResponse.json([]);
        }

        if (!res.ok) {
            // Handle 404 - could mean:
            // 1. No history exists for this address (normal case)
            // 2. API key doesn't have History API access (tier issue)
            // 3. Endpoint format is incorrect
            if (res.status === 404) {
                // Log for debugging
                console.warn(`[1inch History API] 404 for address ${address} on chain ${chainId}. This could mean:`);
                console.warn(`  - No transaction history exists for this address`);
                console.warn(`  - API key may not have History API access (check 1inch Developer Portal)`);
                console.warn(`  - Endpoint format may be incorrect`);
                
                // Return empty array instead of error for 404
                // This allows the UI to show "no transactions" instead of an error
                return NextResponse.json({ items: [] });
            }
            
            // For other errors, return the error response with more context
            const errorMessage = data?.error || data?.message || `1inch API error: ${res.status} ${res.statusText}`;
            console.error(`[1inch History API] Error ${res.status}:`, errorMessage);
            return NextResponse.json(
                { 
                    error: errorMessage,
                    status: res.status,
                    // Include helpful message for common issues
                    hint: res.status === 403 ? "API key may not have History API access. Check your 1inch Developer Portal plan." : undefined
                }, 
                { status: res.status }
            );
        }

        return NextResponse.json(data);
    } catch (error) {
        console.error("1inch History Error:", error);
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 });
    }
}
