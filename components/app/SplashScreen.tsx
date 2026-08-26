"use client";

import { useEffect, useRef, useState } from "react";
import { Wordmark } from "./Wordmark";

/** Minimum time on screen, so a fast boot doesn't flash the splash. */
const MIN_VISIBLE_MS = 1650;
/** Fade duration — matches the CSS transition below. */
const FADE_MS = 520;

/**
 * Launch screen.
 *
 * Shown while Privy initialises. Deliberately CSS-only: this is the first paint
 * of the app, so it must not wait on a motion library to start animating.
 *
 * The sequence is: bloom settles, letters rise and the tracking tightens, a
 * single sheen passes, a hairline fills to signal progress, then the whole
 * thing fades and hands over.
 */
export function SplashScreen({ onComplete }: { onComplete: () => void }) {
  const [leaving, setLeaving] = useState(false);
  const done = useRef(false);

  useEffect(() => {
    const t1 = setTimeout(() => setLeaving(true), MIN_VISIBLE_MS);
    const t2 = setTimeout(() => {
      if (done.current) return;
      done.current = true;
      onComplete();
    }, MIN_VISIBLE_MS + FADE_MS);

    return () => {
      clearTimeout(t1);
      clearTimeout(t2);
    };
  }, [onComplete]);

  return (
    <div
      role="status"
      aria-label="Loading Xylith"
      className="fixed inset-0 z-50 flex flex-col items-center justify-center bg-[color:var(--color-surface)] xy-ease"
      style={{
        opacity: leaving ? 0 : 1,
        // A whisper of scale on exit reads as the screen receding rather than
        // simply switching off.
        transform: leaving ? "scale(1.015)" : "scale(1)",
        transition: `opacity ${FADE_MS}ms, transform ${FADE_MS}ms`,
      }}
    >
      {/* Accent bloom — the only colour on the screen, kept well under the type. */}
      <div
        aria-hidden="true"
        className="xy-anim-bloom pointer-events-none absolute"
        style={{
          width: "min(34rem, 82vw)",
          height: "min(34rem, 82vw)",
          background:
            "radial-gradient(closest-side, color-mix(in oklab, var(--color-accent) 26%, transparent), transparent)",
          filter: "blur(56px)",
          animation: "xy-bloom 4.5s ease-in-out infinite",
        }}
      />

      <Wordmark className="text-[clamp(2rem,9vw,3.75rem)]" delay={0.12} />

      {/* Progress hairline. Scales rather than animating width — width would
          trigger layout on every frame. */}
      <div
        aria-hidden="true"
        className="relative mt-9 h-px w-[min(11rem,42vw)] overflow-hidden"
        style={{ background: "var(--color-border)" }}
      >
        <div
          className="xy-anim-hairline absolute inset-0 origin-left"
          style={{
            background: "var(--color-accent)",
            animation: `xy-hairline ${MIN_VISIBLE_MS}ms cubic-bezier(0.4,0,0.2,1) both`,
          }}
        />
      </div>
    </div>
  );
}
