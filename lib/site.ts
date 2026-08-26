/**
 * Domain configuration for the wallet app.
 *
 * The app keeps its existing origin (xylith-wallet.vercel.app) — the landing
 * page is what moves to a new host. Nothing about this app's deployment,
 * service worker, PWA installs or Privy configuration changes.
 *
 * Mirrors lib/site.ts in the landing project — keep the two in step.
 */

/**
 * Read an environment URL, falling back when it is missing OR blank OR not a
 * valid URL.
 *
 * `??` is not enough: an environment variable declared with no value arrives as
 * an empty string, which `??` passes straight through. `new URL('')` then
 * throws during module evaluation and fails the build before any page renders.
 */
function envUrl(value: string | undefined, fallback: string): string {
  const trimmed = value?.trim();
  if (!trimmed) return fallback;
  try {
    return new URL(trimmed).toString().replace(/\/$/, "");
  } catch {
    return fallback;
  }
}

export const site = {
  name: "Xylith",
  /** Where this app is served from — unchanged by the landing-page split. */
  url: envUrl(process.env.NEXT_PUBLIC_APP_URL, "https://xylith-wallet.vercel.app"),
  /** The marketing site — linked from the sign-in screen. */
  marketingUrl: envUrl(
    process.env.NEXT_PUBLIC_MARKETING_URL,
    "https://xylith-home.vercel.app",
  ),
} as const;
