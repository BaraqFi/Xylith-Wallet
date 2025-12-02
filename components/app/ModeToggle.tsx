"use client";

import { useApp } from "./AppContext";
import { useRef, useState, useEffect   } from "react";

export function ModeToggle() {
  const { mode, setMode, setShowAiAlert, dontShowAiAlert } = useApp();
  const [pulse, setPulse] = useState<"in" | "out" | null>(null);
  const pulseTimeout = useRef<NodeJS.Timeout | null>(null);

  const handleToggle = () => {
    if (mode === "manual") {
      if (dontShowAiAlert) {
        setMode("ai");
        triggerPulse("in");
      } else {
        setShowAiAlert(true);
      }
    } else {
      setMode("manual");
      triggerPulse("out");
    }
  };



// ... other code ...

  useEffect(() => {
    return () => {
      if (pulseTimeout.current) clearTimeout(pulseTimeout.current);
    };
  }, []);

  function triggerPulse(direction: "in" | "out") {
    setPulse(direction);
    if (pulseTimeout.current) clearTimeout(pulseTimeout.current);
    pulseTimeout.current = setTimeout(() => setPulse(null), 700);
  }

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-[color:var(--color-depth)]/70">
        {mode === "manual" ? "Manual" : "AI"}
      </span>
      <button
        type="button"
        onClick={handleToggle}
        className={`relative h-7 w-12 rounded-full transition-colors overflow-visible ${
          mode === "ai"
            ? "bg-[color:var(--color-accent)]"
            : "bg-[#706f6e]/40 dark:bg-[#706f6e]/60"
        }`}
        aria-label={`Switch to ${mode === "manual" ? "AI" : "Manual"} mode`}
      >
        {/* Pulse Animation Effect */}
        {pulse && (
          <span
            className={`pointer-events-none absolute z-0 left-1/2 top-1/2 h-14 w-14 rounded-full bg-[color:var(--color-accent)]/40
            ${pulse === "in"
              ? "animate-pulse-pulsein"
              : "animate-pulse-pulseout"}
          `}
          />
        )}
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white dark:bg-[#e5e5e5] transition-transform z-10 ${
            mode === "ai" ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
      <style jsx global>{`
        @keyframes pulse-pulsein {
          0% { transform: translate(-50%, -50%) scale(0); opacity: 0.7; }
          80% { opacity: 0.28; }
          100% { transform: translate(-50%, -50%) scale(2.5); opacity: 0; }
        }
        @keyframes pulse-pulseout {
          0% { transform: translate(-50%, -50%) scale(1.7); opacity: 0.2; }
          100% { transform: translate(-50%, -50%) scale(0); opacity: 0; }
        }
        .animate-pulse-pulsein { animation: pulse-pulsein 0.7s cubic-bezier(0.31,1.14,0.37,1) forwards; }
        .animate-pulse-pulseout { animation: pulse-pulseout 0.7s cubic-bezier(0.31,1.14,0.37,1) forwards; }
      `}</style>
    </div>
  );
}

