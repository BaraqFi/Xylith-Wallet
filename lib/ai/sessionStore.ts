/**
 * Session store abstraction for AI-mode session state.
 *
 * Backend selection is automatic:
 *  - When Upstash Redis is configured, the FULL session (incl. encrypted key +
 *    permissions + spend accounting) lives in Redis under `aisession:{userId}` with
 *    a TTL == session expiry. Key material stops transiting Privy entirely.
 *  - Otherwise it falls back to Privy user metadata (read-merge-write, so Privy's
 *    replace-semantics can never wipe an untouched field).
 *
 * Routes only ever call these functions — never `custom_metadata` or Redis directly.
 */

import { getPrivyUser, setPrivyUserMetadata, PrivyUser } from "./privyServer";
import {
  isRedisConfigured,
  redisGet,
  redisSet,
  redisDel,
} from "@/lib/redis/client";

const REDIS_KEY = (userId: string) => `aisession:${userId}`;

export type SpendPeriod = "DAILY" | "WEEKLY";

export type AiSession = {
  /** Session key public address (stored in metadata as `alchemySessionKey`). */
  sessionKeyAddress?: string;
  /** Expiry, unix seconds. */
  sessionExpiry?: number;
  /** Encrypted session key private key (base64 of iv|tag|ciphertext). */
  sessionKeyEnc?: string;
  /** JSON-stringified Alchemy permissions context; "" until the client grant lands. */
  sessionPermissions?: string;
  /** User-configured spend cap in USD for the current period (0 = unset). */
  spendLimitUsd?: number;
  /** USD spent so far in the current period (server-side accounting). */
  spentUsd?: number;
  /** Unix seconds when the current spend period started. */
  periodStart?: number;
  /** Spend period the limit applies to. */
  spendPeriod?: SpendPeriod;
};

const KEYS = {
  address: "alchemySessionKey",
  expiry: "sessionExpiry",
  enc: "sessionKeyEnc",
  perms: "sessionPermissions",
  spendLimitUsd: "spendLimitUsd",
  spentUsd: "spentUsd",
  periodStart: "periodStart",
  spendPeriod: "spendPeriod",
} as const;

type Meta = Record<string, unknown>;

/** Extract session fields from an already-fetched Privy user (no network call). */
export function readSessionFromUser(user: PrivyUser): AiSession {
  const m: Meta = user.custom_metadata ?? {};
  return {
    sessionKeyAddress: (m[KEYS.address] as string) || undefined,
    sessionExpiry: (m[KEYS.expiry] as number) || undefined,
    sessionKeyEnc: (m[KEYS.enc] as string) || undefined,
    sessionPermissions:
      typeof m[KEYS.perms] === "string" ? (m[KEYS.perms] as string) : undefined,
    spendLimitUsd:
      typeof m[KEYS.spendLimitUsd] === "number" ? (m[KEYS.spendLimitUsd] as number) : undefined,
    spentUsd:
      typeof m[KEYS.spentUsd] === "number" ? (m[KEYS.spentUsd] as number) : undefined,
    periodStart:
      typeof m[KEYS.periodStart] === "number" ? (m[KEYS.periodStart] as number) : undefined,
    spendPeriod:
      m[KEYS.spendPeriod] === "WEEKLY" || m[KEYS.spendPeriod] === "DAILY"
        ? (m[KEYS.spendPeriod] as SpendPeriod)
        : undefined,
  };
}

/** Merge a typed patch onto an AiSession (only defined fields overwrite). */
function mergeSession(base: AiSession, patch: AiSession): AiSession {
  const out: AiSession = { ...base };
  (Object.keys(patch) as (keyof AiSession)[]).forEach((k) => {
    if (patch[k] !== undefined) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (out as any)[k] = patch[k];
    }
  });
  return out;
}

/**
 * Fetch the current session for a user. Reads Redis when configured, else Privy
 * metadata. Pass `preloadedUser` (Privy path only) to avoid a redundant fetch.
 */
export async function getSession(
  userId: string,
  preloadedUser?: PrivyUser | null,
): Promise<AiSession | null> {
  if (isRedisConfigured()) {
    const raw = await redisGet(REDIS_KEY(userId));
    if (!raw) return null;
    try {
      return JSON.parse(raw) as AiSession;
    } catch {
      return null;
    }
  }
  const user = preloadedUser ?? (await getPrivyUser(userId));
  if (!user) return null;
  return readSessionFromUser(user);
}

/** TTL (seconds) implied by a session's expiry, or undefined if none/expired. */
function ttlFromExpiry(expiry?: number): number | undefined {
  if (!expiry) return undefined;
  const ttl = expiry - Math.floor(Date.now() / 1000);
  return ttl > 0 ? ttl : undefined;
}

function applyPatch(existing: Meta, patch: AiSession): Meta {
  const merged: Meta = { ...existing };
  if (patch.sessionKeyAddress !== undefined) merged[KEYS.address] = patch.sessionKeyAddress;
  if (patch.sessionExpiry !== undefined) merged[KEYS.expiry] = patch.sessionExpiry;
  if (patch.sessionKeyEnc !== undefined) merged[KEYS.enc] = patch.sessionKeyEnc;
  if (patch.sessionPermissions !== undefined) merged[KEYS.perms] = patch.sessionPermissions;
  if (patch.spendLimitUsd !== undefined) merged[KEYS.spendLimitUsd] = patch.spendLimitUsd;
  if (patch.spentUsd !== undefined) merged[KEYS.spentUsd] = patch.spentUsd;
  if (patch.periodStart !== undefined) merged[KEYS.periodStart] = patch.periodStart;
  if (patch.spendPeriod !== undefined) merged[KEYS.spendPeriod] = patch.spendPeriod;
  return merged;
}

/**
 * Merge a patch into the stored session and persist. Pass `currentMeta` (from an
 * already-fetched user) to skip a redundant read. Untouched fields are preserved.
 */
export async function putSession(
  userId: string,
  patch: AiSession,
  currentMeta?: Meta,
): Promise<boolean> {
  if (isRedisConfigured()) {
    const base = (await getSession(userId)) ?? {};
    const merged = mergeSession(base, patch);
    return redisSet(REDIS_KEY(userId), JSON.stringify(merged), ttlFromExpiry(merged.sessionExpiry));
  }

  let existing = currentMeta;
  if (!existing) {
    const user = await getPrivyUser(userId);
    existing = user?.custom_metadata ?? {};
  }
  const merged = applyPatch(existing, patch);
  return setPrivyUserMetadata(
    userId,
    merged as Record<string, string | number | boolean | null>,
  );
}

/** Clear the session. In Redis mode the key is deleted; in Privy mode the fields
 * are zeroed (preserving any non-session metadata). */
export async function deleteSession(
  userId: string,
  currentMeta?: Meta,
): Promise<boolean> {
  if (isRedisConfigured()) {
    const ok = await redisDel(REDIS_KEY(userId));
    // Best-effort: also clear any pre-Redis session left in Privy metadata.
    try {
      await setPrivyUserMetadata(userId, {
        [KEYS.address]: "",
        [KEYS.expiry]: 0,
        [KEYS.enc]: "",
        [KEYS.perms]: "",
      });
    } catch {
      // ignore
    }
    return ok;
  }

  return putSession(
    userId,
    {
      sessionKeyAddress: "",
      sessionExpiry: 0,
      sessionKeyEnc: "",
      sessionPermissions: "",
      spendLimitUsd: 0,
      spentUsd: 0,
      periodStart: 0,
    },
    currentMeta,
  );
}
