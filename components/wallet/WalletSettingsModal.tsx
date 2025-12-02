"use client";

import { useApp } from "../app/AppContext";
import { DarkModeToggle } from "../app/DarkModeToggle";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";
import { useState, useEffect, useRef } from "react";

export function WalletSettingsScreen() {
  const { currentView, setCurrentView } = useApp();
  const { logout } = usePrivy();
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

    // Save the previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the first focusable element (close button) when modal opens
    const timer = setTimeout(() => {
      firstFocusableRef.current?.focus();
    }, 0);

    // Handle Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape" && !isLoggingOut) {
        handleClose();
      }
    };

    document.addEventListener("keydown", handleEscape);

    return () => {
      clearTimeout(timer);
      document.removeEventListener("keydown", handleEscape);
      // Restore focus to previously focused element
      previousFocusRef.current?.focus();
    };
  }, [isOpen, isLoggingOut, setCurrentView]);

  // Focus trap: keep focus within modal
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
  }, [isOpen]);

  if (!isOpen) return null;

  const handleLogout = async () => {
    setIsLoggingOut(true);
    try {
      await logout();
      window.location.reload(); // ensure full session clear
    } catch (error) {
      console.error("Logout error:", error);
      // Show error to user (you could add a toast notification here)
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
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div>
                <p className="font-medium text-[color:var(--color-depth)]">Appearance</p>
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

