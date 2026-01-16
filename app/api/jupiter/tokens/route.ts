import { NextResponse } from 'next/server';

// Try multiple endpoints as fallback since Jupiter API endpoints have changed
// Priority: Use lite-api.jup.ag/tokens/v1/tagged/strict for strict list
// Fallback to other endpoints if needed
const JUPITER_ENDPOINTS = [
    'https://lite-api.jup.ag/tokens/v1/tagged/strict', // Current API for strict tokens
    'https://token.jup.ag/strict', // Old endpoint (may still work as fallback)
    'https://tokens.jup.ag/all', // Legacy endpoint (very large, use as last resort)
];

export async function GET() {
    let lastError: Error | null = null;

    // Try each endpoint in order
    for (const url of JUPITER_ENDPOINTS) {
        try {
            const response = await fetch(url, {
                headers: {
                    'Accept': 'application/json',
                    'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36'
                },
                // Cache for 1 hour since token lists don't change frequently
                next: { revalidate: 3600 }
            });

            if (!response.ok) {
                throw new Error(`Jupiter API responded with ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();

            // Handle different response formats
            let tokens: any[] = [];
            
            if (Array.isArray(data)) {
                tokens = data;
            } else if (data && Array.isArray(data.tokens)) {
                // Some endpoints wrap the array in an object
                tokens = data.tokens;
            } else if (data && typeof data === 'object') {
                // Try to extract array from common property names
                tokens = data.data || data.items || [];
            }

            // If we got valid token data, return it
            if (Array.isArray(tokens) && tokens.length > 0) {
                return NextResponse.json(tokens);
            }

            // If data is not an array or empty, try next endpoint
            throw new Error('Empty or invalid response format');
        } catch (error: any) {
            lastError = error;
            console.warn(`Failed to fetch from ${url}:`, error.message);
            // Continue to next endpoint
            continue;
        }
    }

    // If all endpoints failed, return error
    console.error('Error fetching Jupiter token list from all endpoints:', lastError);
    return NextResponse.json(
        { 
            error: 'Failed to fetch token list from all available endpoints',
            details: lastError?.message || 'Unknown error'
        },
        { status: 500 }
    );
}
