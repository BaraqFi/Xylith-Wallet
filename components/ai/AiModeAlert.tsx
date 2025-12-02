"use client";

import { useApp } from "../app/AppContext";

export function AiModeAlert() {
  const {
    showAiAlert,
    setShowAiAlert,
    dontShowAiAlert,
    setDontShowAiAlert,
    setMode,
  } = useApp();

  if (!showAiAlert) return null;

  const handleYes = () => {
    setMode("ai");
    setShowAiAlert(false);
  };

  const handleNo = () => {
    setShowAiAlert(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-depth)]/40 p-4">
      <div className="wallet-card max-w-md w-full p-6">
        <h2 className="text-xl font-semibold mb-4 text-[color:var(--color-depth)]">
          Enable AI Mode
        </h2>
        <p className="text-sm text-[color:var(--color-depth)]/70 mb-6">
          AI Mode allows you to execute on-chain transactions through chat commands.
          The AI agent can send tokens, swap assets, and perform trades on your behalf
          using secure session-based permissions.
        </p>
        <div className="flex items-center gap-2 mb-6">
          <input
            type="checkbox"
            id="dont-show-again"
            checked={dontShowAiAlert}
            onChange={(e) => setDontShowAiAlert(e.target.checked)}
            className="h-4 w-4 rounded border-[color:var(--color-depth)]/30"
          />
          <label
            htmlFor="dont-show-again"
            className="text-sm text-[color:var(--color-depth)]/70 cursor-pointer"
          >
            Don&apos;t show this alert again
          </label>
        </div>
        <div className="flex gap-3">
          <button
            type="button"
            onClick={handleYes}
            className="flex-1 rounded-xl bg-[color:var(--color-accent)] px-4 py-3 text-sm font-semibold text-white transition hover:opacity-90"
          >
            Yes, Enable AI Mode
          </button>
          <button
            type="button"
            onClick={handleNo}
            className="flex-1 rounded-xl border border-[color:var(--color-depth)]/20 px-4 py-3 text-sm font-semibold text-[color:var(--color-depth)] transition hover:bg-[color:var(--color-depth)]/5"
          >
            No
          </button>
        </div>
      </div>
    </div>
  );
}

