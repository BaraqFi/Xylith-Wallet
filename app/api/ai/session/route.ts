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
import { sanitizeError } from "@/lib/ai/errorSanitizer";
import { encryptSessionKeyHex } from "@/lib/ai/sessionKeyCrypto";
import crypto from "crypto";

export const runtime = "nodejs";

type SessionBody = {
  // When present, client has already installed the session key and returns the permissions context.
  sessionPermissions?: unknown;
  signerAddress?: string;
};

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

    const body = (await req.json().catch(() => ({}))) as SessionBody;

    const expiresAt = now + SESSION_LIFETIME_SEC;

    // Step 2: client posts the permissions context after installing the session key.
    if (body.sessionPermissions && body.signerAddress) {
      const metadataSet = await setPrivyUserMetadata(userId, {
        alchemySessionKey: body.signerAddress,
        sessionExpiry: expiresAt,
        sessionPermissions: JSON.stringify(body.sessionPermissions),
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
          signerAddress: body.signerAddress,
          expiresAt,
          evmAddress,
        },
        message: `AI mode activated. Session valid for ${SESSION_LIFETIME_SEC / 3600}h.`,
      });
    }

    // Step 1: server generates and stores an encrypted session key. Client must install it.
    const sessionKeyPrivateKey = `0x${crypto.randomBytes(32).toString("hex")}`;
    // eslint-disable-next-line @typescript-eslint/no-var-requires
    const { LocalAccountSigner } = require("@aa-sdk/core");
    const sessionKeySigner = LocalAccountSigner.privateKeyToAccountSigner(sessionKeyPrivateKey);
    const sessionKeyAddress = await sessionKeySigner.getAddress();
    const sessionKeyEnc = encryptSessionKeyHex(sessionKeyPrivateKey);

    const metadataSet = await setPrivyUserMetadata(userId, {
      alchemySessionKey: sessionKeyAddress,
      sessionExpiry: expiresAt,
      sessionKeyEnc,
      sessionPermissions: "",
    });

    if (!metadataSet) {
      return NextResponse.json(
        { error: "Failed to persist session. Please try again." },
        { status: 500 }
      );
    }

    return NextResponse.json({
      status: "needs_client_grant",
      session: {
        signerAddress: sessionKeyAddress,
        expiresAt,
        evmAddress,
      },
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
