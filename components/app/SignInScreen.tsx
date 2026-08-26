"use client";

import { UserPill } from "@privy-io/react-auth/ui";
import { Wordmark } from "./Wordmark";
import { site } from "@/lib/site";

/**
 * Unauthenticated entry screen.
 *
 * Continues the launch sequence rather than restarting it — same wordmark, same
 * easing, same bloom — so signing in feels like the next beat of the splash
 * instead of a different screen.
 */

const assurances = [
  { title: "Non-custodial", body: "Your keys never leave your device." },
  { title: "On-chain limits", body: "The agent spends only what you allow." },
  { title: "Revoke anytime", body: "One tap. Immediate, contract-enforced." },
];

export function SignInScreen() {
  return (
    <div className="relative flex min-h-[100dvh] flex-col items-center justify-center overflow-hidden bg-[color:var(--color-surface)] px-6 py-12">
      <div
        aria-hidden="true"
        className="xy-anim-bloom pointer-events-none absolute -top-24"
        style={{
          width: "min(40rem, 92vw)",
          height: "min(40rem, 92vw)",
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--color-accent) 20%, transparent), transparent)",
          filter: "blur(64px)",
          animation: "xy-bloom 6s ease-in-out infinite",
        }}
      />

      <div className="relative z-10 flex w-full max-w-sm flex-col items-center text-center">
        <Wordmark className="text-[clamp(1.6rem,7vw,2.5rem)]" />

        <p
          className="xy-anim-rise mt-5 text-balance text-sm leading-relaxed text-[color:var(--color-depth)]/60"
          style={{ animation: "xy-rise 0.8s cubic-bezier(0.22,1,0.36,1) 0.45s both" }}
        >
          An AI wallet for EVM and Solana. Say what you want in plain English —
          Xylith executes it, inside limits you set.
        </p>

        {/* Privy renders its own pill at intrinsic width and does not centre
            itself, so it needs a flex wrapper or it sits left of everything
            else on the screen. */}
        <div
          className="xy-anim-rise mt-10 flex w-full justify-center"
          style={{ animation: "xy-rise 0.8s cubic-bezier(0.22,1,0.36,1) 0.6s both" }}
        >
          <UserPill action={{ type: "login" }} expanded={true} />
        </div>

        <ul className="mt-12 w-full space-y-3 text-left">
          {assurances.map((a, i) => (
            <li
              key={a.title}
              className="xy-anim-rise flex items-start gap-3 rounded-2xl border border-[color:var(--color-border)] px-4 py-3"
              style={{
                animation: `xy-rise 0.8s cubic-bezier(0.22,1,0.36,1) ${0.75 + i * 0.08}s both`,
              }}
            >
              <span
                aria-hidden="true"
                className="mt-[0.45rem] h-1.5 w-1.5 shrink-0 rounded-full bg-[color:var(--color-accent)]"
              />
              <span>
                <span className="block text-sm font-semibold text-[color:var(--color-depth)]">
                  {a.title}
                </span>
                <span className="block text-xs text-[color:var(--color-depth)]/55">
                  {a.body}
                </span>
              </span>
            </li>
          ))}
        </ul>

        <div
          className="xy-anim-rise mt-8 flex items-center gap-4 text-xs text-[color:var(--color-depth)]/45"
          style={{ animation: "xy-rise 0.8s cubic-bezier(0.22,1,0.36,1) 1.05s both" }}
        >
          <a
            href={site.marketingUrl}
            className="transition-colors hover:text-[color:var(--color-accent)]"
          >
            What is Xylith?
          </a>
          <span aria-hidden="true" className="h-3 w-px bg-[color:var(--color-border)]" />
          <a
            href="/privacy"
            className="transition-colors hover:text-[color:var(--color-accent)]"
          >
            Privacy
          </a>
          <span aria-hidden="true" className="h-3 w-px bg-[color:var(--color-border)]" />
          <a
            href="/terms"
            className="transition-colors hover:text-[color:var(--color-accent)]"
          >
            Terms
          </a>
        </div>
      </div>
    </div>
  );
}
