"use client";

import { useApp } from "./AppContext";

export function ModeToggle() {
  const { mode, setMode, setShowAiAlert, dontShowAiAlert } = useApp();

  const handleToggle = () => {
    if (mode === "manual") {
      if (dontShowAiAlert) {
        setMode("ai");
      } else {
        setShowAiAlert(true);
      }
    } else {
      setMode("manual");
    }
  };

  return (
    <div className="flex items-center gap-3">
      <span className="text-sm font-medium text-[color:var(--color-depth)]/70">
        {mode === "manual" ? "Manual" : "AI"}
      </span>
      <button
        type="button"
        onClick={handleToggle}
        className={`relative h-7 w-12 rounded-full transition-colors ${
          mode === "ai" ? "bg-[color:var(--color-accent)]" : "bg-[#706f6e]/40 dark:bg-[#706f6e]/60"
        }`}
        aria-label={`Switch to ${mode === "manual" ? "AI" : "Manual"} mode`}
      >
        <span
          className={`absolute top-0.5 left-0.5 h-6 w-6 rounded-full bg-white dark:bg-[#e5e5e5] transition-transform ${
            mode === "ai" ? "translate-x-5" : "translate-x-0"
          }`}
        />
      </button>
    </div>
  );
}

