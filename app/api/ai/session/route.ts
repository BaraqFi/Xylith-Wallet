import { NextRequest, NextResponse } from "next/server";
import {
  verifyPrivyToken,
  getPrivyUser,
  getEmbeddedEvmAddress,
} from "@/lib/ai/privyServer";
import { SESSION_LIFETIME_SEC } from "@/lib/ai/alchemyServer";
import {
  getSession,
  putSession,
  deleteSession,
} from "@/lib/ai/sessionStore";
import { sanitizeError } from "@/lib/ai/errorSanitizer";
import { encryptSessionKeyHex } from "@/lib/ai/sessionKeyCrypto";
import { assertAiEnv } from "@/lib/ai/env";
import { rateLimit } from "@/lib/api/rateLimit";
import { LocalAccountSigner } from "@aa-sdk/core";
import crypto from "crypto";

export const runtime = "nodejs";

type SessionBody = {
  // When present, client has already installed the session key and returns the permissions context.
  sessionPermissions?: unknown;
  signerAddress?: string;
  // User-configured spend policy captured at activation (UX-layer accounting).
  spendLimitUsd?: number;
  spendPeriod?: "DAILY" | "WEEKLY";
};

/**
 * GET /api/ai/session
 * Check the current AI session status for the authenticated user.
 * Reads session reference from Privy user metadata.
 */
export async function GET(req: NextRequest) {
  try {
    assertAiEnv();

    const userId = await verifyPrivyToken(req);
    if (!userId) {
      return NextResponse.json({ status: "unauthenticated" }, { status: 401 });
    }

    const user = await getPrivyUser(userId);
    if (!user) {
      return NextResponse.json({ status: "error", message: "User not found" }, { status: 404 });
    }

    const session = (await getSession(userId, user)) ?? {};
    const sessionKey = session.sessionKeyAddress;
    const sessionExpiry = session.sessionExpiry;

    if (!sessionKey || !sessionExpiry) {
      return NextResponse.json({ status: "none" });
    }

    const now = Math.floor(Date.now() / 1000);
    if (sessionExpiry <= now) {
      return NextResponse.json({ status: "expired" });
    }

    // A session is only usable when the client grant landed (permissions stored)
    // and the encrypted key survives. Reporting "active" on key+expiry alone let
    // half-activated sessions pass status checks while /execute 403'd on every
    // call — the client treats "incomplete" like "none" and re-runs activation.
    if (!session.sessionPermissions || !session.sessionKeyEnc) {
      return NextResponse.json({ status: "incomplete" });
    }

    const evmAddress = getEmbeddedEvmAddress(user);

    return NextResponse.json({
      status: "active",
      session: {
        signerAddress: sessionKey,
        expiresAt: sessionExpiry,
        evmAddress,
        // The stored spend policy is the authority for accounting, so the client
        // hydrates its settings from here rather than showing local defaults.
        spendLimitUsd: session.spendLimitUsd ?? 0,
        spendPeriod: session.spendPeriod ?? "DAILY",
        spentUsd: session.spentUsd ?? 0,
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
    assertAiEnv();

    const userId = await verifyPrivyToken(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    const limited = await rateLimit(req, { limit: 15, windowSec: 60 });
    if (limited) return limited;

    const user = await getPrivyUser(userId);
    if (!user) {
      return NextResponse.json({ error: "User not found" }, { status: 404 });
    }

    const currentMeta = user.custom_metadata ?? {};
    const existing = (await getSession(userId, user)) ?? {};
    const now = Math.floor(Date.now() / 1000);

    // Get user's embedded EVM wallet address (needed by every branch below).
    const evmAddress = getEmbeddedEvmAddress(user);
    if (!evmAddress) {
      return NextResponse.json(
        { error: "No embedded EVM wallet found. Please ensure your wallet is created." },
        { status: 400 }
      );
    }

    const body = (await req.json().catch(() => ({}))) as SessionBody;
    const expiresAt = now + SESSION_LIFETIME_SEC;

    // Step 2 (completion): the client installed the grant and posts the permissions
    // context. This MUST be handled before the "already active" short-circuit below —
    // step 1 already set a future expiry, so an early active-return here would drop the
    // permissions and leave `execute` returning 403 "permissions not installed".
    if (body.sessionPermissions && body.signerAddress) {
      // The server generated the session key in step 1; the client cannot change it.
      if (!existing.sessionKeyAddress || existing.sessionKeyEnc === undefined) {
        return NextResponse.json(
          { error: "No pending session to complete. Please restart AI activation." },
          { status: 409 }
        );
      }
      if (
        body.signerAddress.toLowerCase() !== existing.sessionKeyAddress.toLowerCase()
      ) {
        return NextResponse.json(
          { error: "Session key mismatch. Please restart AI activation." },
          { status: 400 }
        );
      }

      const spendLimitUsd =
        typeof body.spendLimitUsd === "number" && body.spendLimitUsd > 0
          ? body.spendLimitUsd
          : 0;
      const spendPeriod = body.spendPeriod === "WEEKLY" ? "WEEKLY" : "DAILY";

      const stored = await putSession(
        userId,
        {
          sessionExpiry: expiresAt,
          sessionPermissions: JSON.stringify(body.sessionPermissions),
          spendLimitUsd,
          spentUsd: 0,
          periodStart: now,
          spendPeriod,
        },
        currentMeta,
      );
      if (!stored) {
        return NextResponse.json(
          { error: "Failed to persist session. Please try again." },
          { status: 500 }
        );
      }

      return NextResponse.json({
        status: "active",
        session: {
          signerAddress: existing.sessionKeyAddress,
          expiresAt,
          evmAddress,
        },
        message: `AI mode activated. Session valid for ${SESSION_LIFETIME_SEC / 3600}h.`,
      });
    }

    // Fully-active session (key + permissions installed, not expired): nothing to do.
    if (
      existing.sessionKeyAddress &&
      existing.sessionExpiry &&
      existing.sessionExpiry > now &&
      existing.sessionPermissions
    ) {
      return NextResponse.json({
        status: "active",
        session: {
          signerAddress: existing.sessionKeyAddress,
          expiresAt: existing.sessionExpiry,
          evmAddress,
        },
      });
    }

    // Step 1: server generates and stores an encrypted session key. Client must install it.
    const sessionKeyPrivateKey = `0x${crypto.randomBytes(32).toString("hex")}` as `0x${string}`;
    const sessionKeySigner = LocalAccountSigner.privateKeyToAccountSigner(sessionKeyPrivateKey);
    const sessionKeyAddress = await sessionKeySigner.getAddress();
    const sessionKeyEnc = encryptSessionKeyHex(sessionKeyPrivateKey);

    const stored = await putSession(
      userId,
      {
        sessionKeyAddress,
        sessionExpiry: expiresAt,
        sessionKeyEnc,
        sessionPermissions: "",
      },
      currentMeta,
    );
    if (!stored) {
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
    assertAiEnv();

    const userId = await verifyPrivyToken(req);
    if (!userId) {
      return NextResponse.json({ error: "Unauthenticated" }, { status: 401 });
    }

    // Clear ALL session fields, including the encrypted key material. Since the
    // server holds the only copy of the session key, deleting it revokes AI power
    // immediately; the on-chain grant lapses at its <=24h expiry (no on-chain tx
    // needed — see MED-0).
    const cleared = await deleteSession(userId);

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
