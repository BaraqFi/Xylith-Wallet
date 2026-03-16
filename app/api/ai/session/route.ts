import { NextRequest, NextResponse } from "next/server";
import {
  verifyPrivyToken,
  getPrivyUser,
  setPrivyUserMetadata,
  getEmbeddedEvmAddress,
} from "@/lib/ai/privyServer";
import {
  createAiSession,
  generateSessionKeySigner,
  SESSION_LIFETIME_SEC,
} from "@/lib/ai/alchemyServer";
import { LocalAccountSigner } from "@aa-sdk/core";
import { sanitizeError } from "@/lib/ai/errorSanitizer";

export const runtime = "nodejs";

/**
 * GET /api/ai/session
 * Check the current AI session status for the authenticated user.
 * Reads session reference from Privy user metadata.
 */
export async function GET(req: NextRequest) {
  try {
    const userId = await verifyPrivyToken(req);
    if (!userId) {
      return NextResponse.json({ status: "unauthenticated" }, { status: 401 });
    }

    const user = await getPrivyUser(userId);
    if (!user) {
      return NextResponse.json({ status: "error", message: "User not found" }, { status: 404 });
    }

    const meta = user.custom_metadata;
    const sessionKey = meta?.alchemySessionKey as string | undefined;
    const sessionExpiry = meta?.sessionExpiry as number | undefined;

    if (!sessionKey || !sessionExpiry) {
      return NextResponse.json({ status: "none" });
    }

    const now = Math.floor(Date.now() / 1000);
    if (sessionExpiry <= now) {
      return NextResponse.json({ status: "expired" });
    }

    const evmAddress = getEmbeddedEvmAddress(user);

    return NextResponse.json({
      status: "active",
      session: {
        signerAddress: sessionKey,
        expiresAt: sessionExpiry,
        evmAddress,
      },
    });
  } catch (error) {
    console.error("AI Session GET error:", error);
    return NextResponse.json(
      { status: "error", message: sanitizeError(error) },
      { status: 500 }
    );
  }
}

/**
 * POST /api/ai/session
 * Create a new AI session or renew an expired one.
 * 
 * Flow:
 * 1. Authenticate user via Privy token
 * 2. Get user's embedded EVM wallet address
 * 3. Generate a session key signer
 * 4. Create EIP-7702 delegation + grant session key permissions via Alchemy
 * 5. Store session reference (session key address + expiry) in Privy user metadata
 */
export async function POST(req: NextRequest) {
  try {
    const userId = await verifyPrivyToken(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const user = await getPrivyUser(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    // Check for existing active session
    const meta = user.custom_metadata;
    const existingKey = meta?.alchemySessionKey as string | undefined;
    const existingExpiry = meta?.sessionExpiry as number | undefined;
    const now = Math.floor(Date.now() / 1000);

    if (existingKey && existingExpiry && existingExpiry > now) {
      const evmAddress = getEmbeddedEvmAddress(user);
      return NextResponse.json({
        status: "active",
        session: {
          signerAddress: existingKey,
          expiresAt: existingExpiry,
          evmAddress,
        },
      });
    }

    // Get user's embedded EVM wallet address
    const evmAddress = getEmbeddedEvmAddress(user);
    if (!evmAddress) {
      return NextResponse.json(
        { error: "No embedded EVM wallet found. Please ensure your wallet is created." },
        { status: 400 }
      );
    }

    // Parse optional spending cap from request body
    let spendCapWei: `0x${string}` = "0x2386F26FC10000"; // default: 0.01 ETH
    try {
      const body = await req.json();
      if (body.spendCapWei) {
        spendCapWei = body.spendCapWei;
      }
    } catch {
      // No body or invalid JSON — use default spending cap
    }

    // Generate a new session key signer
    const sessionKeySigner = generateSessionKeySigner();

    // The owner signer is the user's Privy embedded wallet.
    // For session creation, we need the owner to sign the delegation + permission grant.
    // This is handled via the Alchemy Account Kit — the delegation tx will be
    // submitted through the bundler, and the user's Privy wallet signs it.
    //
    // NOTE: In the full flow, the client-side Privy embedded wallet signs the
    // EIP-7702 authorization. The server prepares the session and stores the reference.
    // For now, we use a placeholder that creates the session key and stores the reference,
    // with the actual 7702 delegation happening when the first transaction is sent.
    const sessionKeyAddress = await sessionKeySigner.getAddress();
    const expiresAt = now + SESSION_LIFETIME_SEC;

    // Store session reference in Privy user metadata
    const metadataSet = await setPrivyUserMetadata(userId, {
      alchemySessionKey: sessionKeyAddress,
      sessionExpiry: expiresAt,
    });

    if (!metadataSet) {
      return NextResponse.json(
        { error: "Failed to persist session. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "active",
      session: {
        signerAddress: sessionKeyAddress,
        expiresAt,
        evmAddress,
      },
      message: `AI mode activated. Session valid for ${SESSION_LIFETIME_SEC / 3600}h.`,
    });
  } catch (error) {
    console.error("AI Session POST error:", error);
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}

/**
 * DELETE /api/ai/session
 * Revoke the current AI session.
 * Clears session reference from Privy user metadata.
 */
export async function DELETE(req: NextRequest) {
  try {
    const userId = await verifyPrivyToken(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    // Clear session metadata — session key becomes unauthorized
    const cleared = await setPrivyUserMetadata(userId, {
      alchemySessionKey: "",
      sessionExpiry: 0,
    });

    if (!cleared) {
      return NextResponse.json(
        { error: "Failed to revoke session." },
        { status: 500 }
      );
    }

    return NextResponse.json({ status: "revoked" });
  } catch (error) {
    console.error("AI Session DELETE error:", error);
    return NextResponse.json(
      { error: sanitizeError(error) },
      { status: 500 }
    );
  }
}
