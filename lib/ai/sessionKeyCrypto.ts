import crypto from "crypto";

const SECRET = process.env.AI_SESSION_KEY_SECRET || "";

function getKey(): Buffer {
  // Accept 32-byte base64 or hex; otherwise derive a key (dev only).
  if (/^[A-Fa-f0-9]{64}$/.test(SECRET)) {
    return Buffer.from(SECRET, "hex");
  }
  try {
    const b = Buffer.from(SECRET, "base64");
    if (b.length === 32) return b;
  } catch {
    // ignore
  }

  // Dev fallback: derive from SECRET string (still deterministic, not secure).
  return crypto.createHash("sha256").update(SECRET || "dev").digest();
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
  const decipher = crypto.createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  const plaintext = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
  return plaintext.toString("utf8");
}

