"use client";

import { useEffect } from "react";

/**
 * App-level error boundary.
 *
 * Without this, any client-side exception replaced the whole app with the
 * framework's bare "This page couldn't load" screen — which, mid-transaction,
 * looks like the wallet broke. This keeps the user inside the product, logs the
 * real error for diagnosis, and offers a retry that does not lose the session.
 */
export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error("Unhandled application error:", error);
  }, [error]);

  return (
    <div className="flex min-h-[100dvh] flex-col items-center justify-center bg-[color:var(--color-surface)] px-6 py-12 text-center">
      <div className="w-full max-w-sm">
        <h1 className="text-lg font-semibold text-[color:var(--color-depth)]">
          Something broke on this screen
        </h1>
        <p className="mt-2 text-sm leading-relaxed text-[color:var(--color-depth)]/60">
          Your funds and wallet are unaffected — this is a display error. If you
          were sending a transaction, check your history before retrying so you
          don&apos;t send twice.
        </p>
        {error.digest && (
          <p className="mt-3 font-mono text-[10px] text-[color:var(--color-depth)]/40">
            ref: {error.digest}
          </p>
        )}
        <div className="mt-6 flex justify-center gap-3">
          <button
            onClick={reset}
            className="rounded-full bg-[color:var(--color-accent)] px-5 py-2.5 text-sm font-semibold text-white transition-opacity hover:opacity-90"
          >
            Try again
          </button>
          <button
            // A full reload, not a client-side navigation: whatever state caused
            // the crash should not survive into the wallet view.
            onClick={() => window.location.assign("/")}
            className="rounded-full border border-[color:var(--color-border)] px-5 py-2.5 text-sm font-semibold text-[color:var(--color-depth)] transition-colors hover:bg-[color:var(--color-depth)]/5"
          >
            Back to wallet
          </button>
        </div>
      </div>
    </div>
  );
}
