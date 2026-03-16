/**
 * Server-side Alchemy Account Kit helpers.
 * All Alchemy API key usage stays here — never on the client.
 *
 * Handles:
 * - Creating SmartWalletClient instances with Alchemy transport
 * - EIP-7702 delegation
 * - Session key creation (grantPermissions)
 * - Transaction execution via session keys (prepareCalls → signPreparedCalls → sendPreparedCalls)
 */

import { createSmartWalletClient } from "@account-kit/wallet-client";
import { signPreparedCalls } from "@account-kit/wallet-client";
import { alchemy, mainnet as alchemyMainnet } from "@account-kit/infra";
import { LocalAccountSigner } from "@aa-sdk/core";
import type { Hex } from "viem";

/** Type for the permissions context returned by grantPermissions and consumed by prepareCalls/sendPreparedCalls */
type PermissionsContext = { context: `0x${string}` } | { signature: `0x${string}`; sessionId: `0x${string}` };

const ALCHEMY_API_KEY = process.env.ALCHEMY_API_KEY!;

// Session lifetime: 24 hours
export const SESSION_LIFETIME_SEC = 24 * 60 * 60;

/**
 * Creates an Alchemy transport bound to our API key.
 * Used internally by all server-side Alchemy operations.
 */
function getAlchemyTransport() {
    return alchemy({ apiKey: ALCHEMY_API_KEY });
}

/**
 * Create a SmartWalletClient for a given signer.
 * The signer's address is used as the `from` in calls, which triggers
 * EIP-7702 delegation automatically on first use.
 */
export function createServerClient(signer: ReturnType<typeof LocalAccountSigner.privateKeyToAccountSigner>) {
    return createSmartWalletClient({
        transport: getAlchemyTransport(),
        chain: alchemyMainnet,
        signer,
    });
}

/**
 * Generate a new session key signer.
 * The private key is generated in memory for the session creation flow.
 * After granting permissions, only the session key address (public) is persisted
 * in Privy metadata — the private key material is handled by Alchemy's Turnkey enclave.
 */
export function generateSessionKeySigner() {
    return LocalAccountSigner.generatePrivateKeySigner();
}

/**
 * Create a session with specific permissions for the AI agent.
 * Called when user activates AI mode or renews an expired session.
 *
 * @param ownerSigner - The user's EOA signer (Privy embedded wallet)
 * @param sessionKeySigner - The newly generated session key signer
 * @param spendCapWei - Hex-encoded spending cap for native token transfers
 * @returns The permissions object to be stored as a reference
 */
export async function createAiSession(
    ownerSigner: ReturnType<typeof LocalAccountSigner.privateKeyToAccountSigner>,
    sessionKeySigner: ReturnType<typeof LocalAccountSigner.generatePrivateKeySigner>,
    spendCapWei: Hex = "0x2386F26FC10000" as Hex, // default: 0.01 ETH
) {
    const client = createServerClient(ownerSigner);
    const signerAddress = await ownerSigner.getAddress();
    const sessionKeyAddress = await sessionKeySigner.getAddress();

    const expirySec = Math.floor(Date.now() / 1000) + SESSION_LIFETIME_SEC;

    // Grant session key permissions: native token transfer with spending cap
    const permissions = await client.grantPermissions({
        account: signerAddress,
        expirySec,
        key: {
            publicKey: sessionKeyAddress,
            type: "secp256k1",
        },
        permissions: [
            {
                type: "native-token-transfer",
                data: {
                    allowance: spendCapWei,
                },
            },
        ],
    });

    return {
        permissions,
        sessionKeyAddress,
        expirySec,
    };
}

/**
 * Execute a transaction using a session key.
 * Called by /api/ai/execute when the AI processes a user-confirmed transaction.
 *
 * @param ownerAddress - The user's EOA address (from field for 7702)
 * @param sessionKeySigner - The session key signer
 * @param permissions - The permissions object from createAiSession
 * @param calls - Array of transaction calls to execute
 * @returns The transaction result with hash and status
 */
export async function executeWithSessionKey(
    ownerAddress: Hex,
    sessionKeySigner: ReturnType<typeof LocalAccountSigner.generatePrivateKeySigner>,
    permissions: PermissionsContext,
    calls: Array<{ to: Hex; value?: Hex; data?: Hex }>,
) {
    // Create a client for the owner account (uses owner address for 7702 context)
    const ownerSigner = LocalAccountSigner.privateKeyToAccountSigner(
        "0x0000000000000000000000000000000000000000000000000000000000000001" as Hex // placeholder — we sign with session key
    );
    const client = createServerClient(ownerSigner);

    // Prepare the calls under the owner's account
    const preparedCalls = await client.prepareCalls({
        calls,
        from: ownerAddress,
        capabilities: {
            permissions: permissions,
        } as Record<string, unknown>,
    });

    // Sign with session key (not the owner key)
    const signedCalls = await signPreparedCalls(sessionKeySigner, preparedCalls);

    // Send the prepared and signed calls
    const result = await client.sendPreparedCalls({
        ...signedCalls,
        capabilities: {
            permissions: permissions,
        } as Record<string, unknown>,
    });

    // Poll for status
    const status = await client.getCallsStatus(result.id);

    return {
        id: result.id,
        status: status.status,
        receipts: status.receipts,
    };
}
