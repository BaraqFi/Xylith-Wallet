"use client";

import { useApp } from "../app/AppContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { X } from "lucide-react";
import { DarkModeToggle } from "../app/DarkModeToggle";

export function WalletSettingsModal() {
  const { currentView, setCurrentView } = useApp();
  const isOpen = currentView === "settings";

  const handleClose = () => {
    setCurrentView("wallet");
  };

  return (
    <Dialog open={isOpen} onOpenChange={handleClose}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Wallet Settings</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="absolute top-4 right-4">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

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
        </div>
      </DialogContent>
    </Dialog>
  );
}

