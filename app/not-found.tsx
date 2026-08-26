import Link from "next/link";
import { Wordmark } from "@/components/app/Wordmark";

/**
 * Custom 404. Same surface, wordmark, and easing as the splash/sign-in screens
 * so a dead link still lands inside the product instead of a bare Next page.
 */
export default function NotFound() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[color:var(--color-surface)] px-6 py-12">
      <div
        aria-hidden="true"
        className="pointer-events-none absolute -top-24"
        style={{
          width: "min(40rem, 92vw)",
          height: "min(40rem, 92vw)",
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--color-accent) 20%, transparent), transparent)",
          filter: "blur(64px)",
        }}
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
        <Wordmark className="text-[clamp(1.6rem,7vw,2.5rem)]" />

        <p className="mt-6 text-sm font-semibold uppercase tracking-widest text-[color:var(--color-depth)]/40">
          404
        </p>
        <p className="mt-2 text-balance text-sm leading-relaxed text-[color:var(--color-depth)]/60">
          This page doesn&apos;t exist. Your wallet is fine — it&apos;s just the
          address that&apos;s wrong.
        </p>

        <Link
          href="/"
          className="mt-8 rounded-full bg-[color:var(--color-accent)] px-6 py-3 text-sm font-semibold text-white transition-opacity hover:opacity-90"
        >
          Back to your wallet
        </Link>
      </div>
    </div>
  );
}
