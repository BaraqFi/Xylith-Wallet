"use client";

import { useApp } from "../app/AppContext";
import { DarkModeToggle } from "../app/DarkModeToggle";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { usePrivy } from "@privy-io/react-auth";

export function WalletSettingsScreen() {
  const { currentView, setCurrentView } = useApp();
  const { logout } = usePrivy();
  const isOpen = currentView === "settings";

  if (!isOpen) return null;

  const handleClose = () => setCurrentView("wallet");
  const handleLogout = async () => {
    await logout();
    window.location.reload(); // ensure full session clear
  };

  return (
    <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center">
      <div className="relative w-full max-w-md m-6 bg-white dark:bg-[#232323] rounded-lg shadow-xl p-6 animate-in fade-in-0">
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 hover:bg-black/10 transition"
        >
          <X className="h-5 w-5 text-[color:var(--color-depth)]" />
        </button>
        <h2 className="text-xl font-bold mb-6">Wallet Settings</h2>
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
            <Button onClick={handleLogout} variant="destructive" className="w-full">Lock Wallet / Logout</Button>
            <span className="text-xs mt-2 text-[color:var(--color-depth)]/50">Ends your session</span>
          </div>
        </div>
      </div>
    </div>
  );
}

