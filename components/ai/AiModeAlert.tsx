"use client";

import { useApp } from "../app/AppContext";
import { useEffect, useRef, useCallback } from "react";

export function AiModeAlert() {
  const {
    showAiAlert,
    setShowAiAlert,
    dontShowAiAlert,
    setDontShowAiAlert,
    setMode,
  } = useApp();
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null);

  const handleNo = useCallback(() => {
    setShowAiAlert(false);
  }, [setShowAiAlert]);

  useEffect(() => {
    if (!showAiAlert) return;

    // Save the previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the first focusable element (Yes button) when modal opens
    const timer = setTimeout(() => {
      firstFocusableRef.current?.focus();
    }, 0);

    // Handle Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        handleNo();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleEscape);
      // Restore focus to previously focused element
      previousFocusRef.current?.focus();
    };
  }, [showAiAlert, handleNo]);

  // Focus trap: keep focus within modal
  useEffect(() => {
    if (!showAiAlert || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        // Shift + Tab
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        // Tab
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener("keydown", handleTabKey);
    return () => modal.removeEventListener("keydown", handleTabKey);
  }, [showAiAlert]);

  if (!showAiAlert) return null;

  const handleYes = () => {
    setMode("ai");
    setShowAiAlert(false);
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-depth)]/40 p-4"
      role="dialog"
      aria-modal="true"
      aria-labelledby="ai-mode-alert-title"
    >
      <div ref={modalRef} className="wallet-card max-w-md w-full p-6" role="document">
        <h2 id="ai-mode-alert-title" className="text-xl font-semibold mb-4 text-[color:var(--color-depth)]">
          Enable AI Mode
        </h2>
        <p className="text-sm text-[color:var(--color-depth)]/70 mb-6">
          AI Mode upgrades your wallet with a one-time delegation so the AI agent
          can execute transactions on your behalf within set spending limits.
          You stay in control — your wallet address doesn&apos;t change, and you can
          revoke access at any time from settings.
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
            ref={firstFocusableRef}
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

