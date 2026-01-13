"use client";

import { useApp } from "../app/AppContext";
import { DarkModeToggle } from "../app/DarkModeToggle";
import { Button } from "@/components/ui/button";
import { X, Loader2, KeyRound } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useState, useEffect, useRef } from "react";

export function WalletSettingsScreen() {
  const { currentView, setCurrentView } = useApp();
  const { exportWallet, logout } = usePrivy();
  const [isLoggingOut, setIsLoggingOut] = useState(false);

  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null);
  const isOpen = currentView === "settings";

  const handleClose = () => {
    if (!isLoggingOut) {
      setCurrentView("wallet");
    }
  };

  useEffect(() => {
    if (!isOpen) return;

    previousFocusRef.current = document.activeElement as HTMLElement;

    const timer = setTimeout(() => {
      firstFocusableRef.current?.focus();
    }, 0);

    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoggingOut) {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleEscape);
      previousFocusRef.current?.focus();
    };
  }, [isOpen, isLoggingOut, setCurrentView]);

  useEffect(() => {
    if (!isOpen || !modalRef.current) return;

    const modal = modalRef.current;
    const focusableElements = modal.querySelectorAll<HTMLElement>(
      'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
    );
    const firstElement = focusableElements[0];
    const lastElement = focusableElements[focusableElements.length - 1];

    const handleTabKey = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (e.shiftKey) {
        if (document.activeElement === firstElement) {
          e.preventDefault();
          lastElement?.focus();
        }
      } else {
        if (document.activeElement === lastElement) {
          e.preventDefault();
          firstElement?.focus();
        }
      }
    };

    modal.addEventListener("keydown", handleTabKey);
    return () => modal.removeEventListener("keydown", handleTabKey);
  }, [isOpen]);

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      window.location.reload();
    } catch (error) {
      console.error("Logout error:", error);
      setIsLoggingOut(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="wallet-settings-title"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-md m-6 bg-white dark:bg-[#232323] rounded-lg shadow-xl p-6 animate-in fade-in-0"
        role="document"
      >
        <button
          ref={firstFocusableRef}
          onClick={handleClose}
          aria-label="Close settings"
          className="absolute top-4 right-4 rounded-lg p-1.5 hover:bg-black/10 transition"
          disabled={isLoggingOut}
        >
          <X className="h-5 w-5 text-[color:var(--color-depth)]" />
        </button>
        <h2 id="wallet-settings-title" className="text-xl font-bold mb-6">Wallet Settings</h2>
        <div className="space-y-6 pt-4">

          {/* Security Section */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-[color:var(--color-depth)]/60 border-b border-[color:var(--color-border)] pb-2">Security</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[color:var(--color-depth)]">Export Private Key</p>
                <p className="text-sm text-[color:var(--color-depth)]/60">
                  Reveals your private key. Keep it secret.
                </p>
              </div>
              <Button variant="outline" onClick={exportWallet}>
                <KeyRound className="mr-2 h-4 w-4" />
                Export
              </Button>
            </div>
          </div>

          {/* Appearance Section */}
          <div className="space-y-4">
             <h3 className="text-sm font-semibold text-[color:var(--color-depth)]/60 border-b border-[color:var(--color-border)] pb-2">Appearance</h3>
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[color:var(--color-depth)]">Theme</p>
                <p className="text-sm text-[color:var(--color-depth)]/60">
                  Choose your preferred theme
                </p>
              </div>
              <DarkModeToggle />
            </div>
          </div>

          <div className="pt-6 flex flex-col items-center">
            <Button
              onClick={handleLogout}
              variant="destructive"
              className="w-full"
              disabled={isLoggingOut}
            >
              {isLoggingOut ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Logging out...
                </>
              ) : (
                "Lock Wallet / Logout"
              )}
            </Button>
            <span className="text-xs mt-2 text-[color:var(--color-depth)]/50">Ends your session</span>
          </div>
        </div>
      </div>
    </div>
  );
}

