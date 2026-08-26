/**
 * Server-side environment validation for AI-mode routes.
 *
 * These routes sign and broadcast transactions on the user's behalf, so a
 * misconfigured secret must fail loudly and immediately rather than silently
 * falling back to an insecure default. `assertAiEnv()` is called at the top of
 * every /api/ai/* handler; it throws a single aggregated error if anything is
 * missing or malformed.
 */

/** Returns true if `value` is a 32-byte key encoded as hex (64 chars) or base64. */
export function isValid32ByteKey(value: string | undefined): boolean {
    if (!value) return false;
    if (/^[A-Fa-f0-9]{64}$/.test(value)) return true;
    try {
        const b = Buffer.from(value, "base64");
        return b.length === 32;
    } catch {
        return false;
    }
}

type RequiredEnv = {
    AI_SESSION_KEY_SECRET: string;
    PRIVY_APP_SECRET: string;
    ALCHEMY_API_KEY: string;
    GEMINI_API_KEY: string;
};

/**
 * Validates that all secrets required by AI mode are present and well-formed.
 * Throws with an aggregated, non-leaking message if not. Returns the validated
 * values so callers can use them without re-reading process.env.
 */
export function assertAiEnv(): RequiredEnv {
    const problems: string[] = [];

    const secret = process.env.AI_SESSION_KEY_SECRET;
    if (!isValid32ByteKey(secret)) {
        problems.push(
            "AI_SESSION_KEY_SECRET must be a 32-byte key (64 hex chars or base64). " +
            "Generate with: openssl rand -hex 32",
        );
    }

    const privySecret = process.env.PRIVY_APP_SECRET;
    if (!privySecret || privySecret.length < 16) {
        problems.push("PRIVY_APP_SECRET is missing or too short.");
    }

    const alchemyKey = process.env.ALCHEMY_API_KEY;
    if (!alchemyKey || alchemyKey.length < 8) {
        problems.push("ALCHEMY_API_KEY is missing.");
    }

    const geminiKey = process.env.GEMINI_API_KEY;
    if (!geminiKey || geminiKey.length < 8) {
        problems.push("GEMINI_API_KEY is missing.");
    }

    if (problems.length > 0) {
        throw new Error(`AI environment misconfigured: ${problems.join(" | ")}`);
    }

    return {
        AI_SESSION_KEY_SECRET: secret as string,
        PRIVY_APP_SECRET: privySecret as string,
        ALCHEMY_API_KEY: alchemyKey as string,
        GEMINI_API_KEY: geminiKey as string,
    };
}
