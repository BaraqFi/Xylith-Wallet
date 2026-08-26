"use client";

/**
 * The Xylith wordmark, animated letter by letter.
 *
 * Shared by the boot splash and the sign-in screen so the two read as one
 * continuous launch sequence rather than two unrelated screens.
 */
export function Wordmark({
  className = "",
  delay = 0,
}: {
  className?: string;
  delay?: number;
}) {
  const letters = [..."XYLITH"];

  return (
    <div className={`relative inline-flex overflow-hidden ${className}`}>
      <h1
        className="xy-anim-track flex text-[color:var(--color-depth)]"
        style={{
          fontSize: "inherit",
          fontWeight: 600,
          animation: `xy-track-in 1.4s cubic-bezier(0.22,1,0.36,1) ${delay}s both`,
        }}
      >
        {letters.map((ch, i) => (
          <span
            key={i}
            className="xy-anim-letter inline-block"
            style={{
              // Staggered rise, ~55ms apart — fast enough to feel like one
              // gesture, slow enough to read as deliberate.
              animation: `xy-letter-in 0.85s cubic-bezier(0.22,1,0.36,1) ${delay + i * 0.055}s both`,
            }}
          >
            {ch}
          </span>
        ))}
      </h1>

      {/* Sheen sweeps once across the wordmark after the letters have settled. */}
      <span
        aria-hidden="true"
        className="xy-anim-sheen pointer-events-none absolute inset-y-0 w-1/3"
        style={{
          background:
            "linear-gradient(100deg, transparent, color-mix(in oklab, var(--color-accent) 55%, transparent), transparent)",
          filter: "blur(6px)",
          animation: `xy-sheen 1.5s cubic-bezier(0.4,0,0.2,1) ${delay + 0.55}s both`,
        }}
      />
    </div>
  );
}
