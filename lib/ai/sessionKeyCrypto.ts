import crypto from "crypto";
import { isValid32ByteKey } from "./env";

/**
 * Returns the 32-byte AES key from AI_SESSION_KEY_SECRET.
 * Accepts a 64-char hex string or a 32-byte base64 string. There is NO
 * derive-from-arbitrary-string fallback: a missing/malformed secret throws so
 * session keys are never encrypted under a guessable key.
 */
function getKey(): Buffer {
  const secret = process.env.AI_SESSION_KEY_SECRET;
  if (!isValid32ByteKey(secret)) {
    throw new Error(
      "AI_SESSION_KEY_SECRET is missing or not a valid 32-byte key (hex/base64).",
    );
  }
  // secret is validated above.
  const s = secret as string;
  if (/^[A-Fa-f0-9]{64}$/.test(s)) {
    return Buffer.from(s, "hex");
  }
  return Buffer.from(s, "base64");
}

export function encryptSessionKeyHex(privateKeyHex: string): string {
  const key = getKey();
  const iv = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv("aes-256-gcm", key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(privateKeyHex, "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

export function decryptSessionKeyHex(payloadB64: string): string {
  const key = getKey();
  const raw = Buffer.from(payloadB64, "base64");
  const iv = raw.subarray(0, 12);
  const tag = raw.subarray(12, 28);
  const ciphertext = raw.subarray(28);
  try {
    const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
    decipher.setAuthTag(tag);
    const plaintext = Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]);
    return plaintext.toString("utf8");
  } catch {
    // Auth failure = wrong key (e.g. secret rotated) or tampered payload.
    // Fail closed with a recognizable marker so callers can prompt re-activation.
    throw new Error("SESSION_KEY_DECRYPT_FAILED");
  }
}
