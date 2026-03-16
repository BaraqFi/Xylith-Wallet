/**
 * Server-side Privy authentication and metadata helpers.
 * All sensitive operations (Alchemy API key, Privy app secret) stay here — never on the client.
 */

import { NextRequest } from "next/server";

const PRIVY_APP_ID = "cmid35rfp01xlks0cujzvl6wk";
const PRIVY_APP_SECRET = process.env.PRIVY_APP_SECRET!;
const PRIVY_API_BASE = "https://auth.privy.io";

/** Basic Auth header for Privy API calls */
function getPrivyAuthHeader(): string {
    return `Basic ${Buffer.from(`${PRIVY_APP_ID}:${PRIVY_APP_SECRET}`).toString("base64")}`;
}

/**
 * Verifies the Privy access token from the Authorization header.
 * Returns the authenticated user's Privy ID, or null if invalid.
 */
export async function verifyPrivyToken(req: NextRequest): Promise<string | null> {
    const authHeader = req.headers.get("authorization");
    if (!authHeader?.startsWith("Bearer ")) return null;

    const token = authHeader.slice(7);

    try {
        const res = await fetch(`${PRIVY_API_BASE}/api/v1/token/verify`, {
            method: "POST",
            headers: {
                "Authorization": getPrivyAuthHeader(),
                "privy-app-id": PRIVY_APP_ID,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ token }),
        });

        if (!res.ok) return null;

        const data = await res.json();
        return data.userId || data.user_id || null;
    } catch {
        return null;
    }
}

/**
 * Fetch a Privy user object by their ID.
 * Contains linkedAccounts, customMetadata, and embedded wallet addresses.
 */
export async function getPrivyUser(userId: string): Promise<PrivyUser | null> {
    try {
        const res = await fetch(`${PRIVY_API_BASE}/api/v1/users/${userId}`, {
            method: "GET",
            headers: {
                "Authorization": getPrivyAuthHeader(),
                "privy-app-id": PRIVY_APP_ID,
            },
        });

        if (!res.ok) return null;
        return await res.json();
    } catch {
        return null;
    }
}

/**
 * Write custom metadata to a Privy user.
 * Used to persist session references (session key address + expiry).
 */
export async function setPrivyUserMetadata(
    userId: string,
    metadata: Record<string, string | number | boolean | null>
): Promise<boolean> {
    try {
        const res = await fetch(`${PRIVY_API_BASE}/api/v1/users/${userId}/custom_metadata`, {
            method: "POST",
            headers: {
                "Authorization": getPrivyAuthHeader(),
                "privy-app-id": PRIVY_APP_ID,
                "Content-Type": "application/json",
            },
            body: JSON.stringify({ custom_metadata: metadata }),
        });

        return res.ok;
    } catch {
        return false;
    }
}

/** Minimal shape of a Privy user object for our needs */
export interface PrivyUser {
    id: string;
    linked_accounts: Array<{
        type: string;
        address?: string;
        chain_type?: string;
        wallet_client_type?: string;
    }>;
    custom_metadata?: Record<string, unknown>;
}

/**
 * Extract the user's embedded EVM wallet address from their Privy linked accounts.
 */
export function getEmbeddedEvmAddress(user: PrivyUser): string | null {
    const embedded = user.linked_accounts.find(
        (a) => a.type === "wallet" && a.chain_type === "ethereum" && a.wallet_client_type === "privy"
    );
    return embedded?.address || null;
}

/**
 * Extract the user's embedded Solana wallet address from their Privy linked accounts.
 */
export function getEmbeddedSolAddress(user: PrivyUser): string | null {
    const embedded = user.linked_accounts.find(
        (a) => a.type === "wallet" && a.chain_type === "solana" && a.wallet_client_type === "privy"
    );
    return embedded?.address || null;
}
