"use client";

import { useState, useMemo } from "react";
import { useApp } from "../app/AppContext";
import { manualWalletState, Chain } from "./data";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogClose,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Copy, Check, X, AlertTriangle } from "lucide-react";

function QRCodeGrid({ address }: { address: string }) {
  const grid = useMemo(() => {
    const seed = address
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array.from({ length: 144 }).map((_, i) => {
      const hash = (seed + i) * (i % 10);
      return hash % 3 === 0;
    });
  }, [address]);

  return (
    <div className="grid grid-cols-12 gap-0.5">
      {grid.map((isDark, i) => (
        <div
          key={i}
          className={`aspect-square ${
            isDark ? "bg-[color:var(--color-depth)]" : "bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}

export function ReceiveModal() {
  const { currentView, setCurrentView } = useApp();
  const [selectedChain, setSelectedChain] = useState<Chain>(
    manualWalletState.activeChain
  );
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  const address =
    selectedChain === "EVM"
      ? manualWalletState.address
      : "Abc123456789012345678901234567890123456789012345678901234567";

  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleClose = () => {
    setCurrentView("wallet");
  };

  return (
    <Dialog open={currentView === "receive"} onOpenChange={handleClose}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Receive</DialogTitle>
          <DialogClose asChild>
            <Button variant="ghost" size="icon" className="absolute top-4 right-4">
              <X className="h-4 w-4" />
            </Button>
          </DialogClose>
        </DialogHeader>

        <div className="space-y-6 pt-4">
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--color-depth)]">
              Network
            </label>
            <div className="grid grid-cols-2 gap-2 rounded-lg border border-[color:var(--color-border)] p-1">
              {(["EVM", "Solana"] as Chain[]).map((chain) => (
                <Button
                  key={chain}
                  variant={selectedChain === chain ? "secondary" : "ghost"}
                  onClick={() => setSelectedChain(chain)}
                >
                  {chain}
                </Button>
              ))}
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2 rounded-lg border border-[color:var(--color-border)] p-1">
            <Button
              variant={!showQr ? "secondary" : "ghost"}
              onClick={() => setShowQr(false)}
            >
              Address
            </Button>
            <Button
              variant={showQr ? "secondary" : "ghost"}
              onClick={() => setShowQr(true)}
            >
              QR Code
            </Button>
          </div>

          {showQr ? (
            <div className="flex flex-col items-center gap-4 rounded-lg border border-[color:var(--color-border)] p-6">
              <div className="flex items-center justify-center rounded-lg bg-white p-2">
                <div className="h-48 w-48">
                  <QRCodeGrid address={address} />
                </div>
              </div>
              <p className="text-center text-sm text-[color:var(--color-depth)]/60">
                Scan this QR code to receive {selectedChain} assets
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-lg border border-[color:var(--color-border)] bg-[color:var(--color-depth)]/5 p-4">
                <p className="mb-2 text-sm text-[color:var(--color-depth)]/60">
                  Your {selectedChain} address
                </p>
                <p className="break-all font-mono text-sm">{address}</p>
              </div>
              <Button onClick={handleCopy} className="w-full">
                {copied ? (
                  <Check className="mr-2 h-4 w-4" />
                ) : (
                  <Copy className="mr-2 h-4 w-4" />
                )}
                {copied ? "Copied!" : "Copy Address"}
              </Button>
            </div>
          )}

          <div className="flex items-start gap-3 rounded-lg border border-yellow-200 bg-yellow-50 p-4 dark:border-yellow-800 dark:bg-yellow-900/20">
            <AlertTriangle className="h-5 w-5 text-yellow-600 dark:text-yellow-400" />
            <p className="text-sm text-yellow-800 dark:text-yellow-300">
              Only send {selectedChain} assets to this address. Sending other
              assets may result in permanent loss.
            </p>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

