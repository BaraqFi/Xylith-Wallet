"use client";

import { useState, useMemo, useEffect, useRef } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { useApp } from "../app/AppContext";
import { manualWalletState, Chain } from "../wallet/data";
import { Button } from "@/components/ui/button";
import { Copy, Check, X, AlertTriangle } from "lucide-react";

function QRCodeGrid({ address }: { address: string }) {
  const grid = useMemo(() => {
    const seed = address
      .split("")
      .reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array.from({ length: 144 }).map((_, i) => {
      const hash = (seed + i) * ((i % 10) + 1);
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

export function ReceiveScreen() {
  const { currentView, setCurrentView, activeChain, setActiveChain } = useApp();
  const { user } = usePrivy();
  const [selectedChain, setSelectedChain] = useState<Chain>(activeChain);
  const modalRef = useRef<HTMLDivElement>(null);
  const previousFocusRef = useRef<HTMLElement | null>(null);
  const firstFocusableRef = useRef<HTMLButtonElement | null>(null);

  const handleClose = () => setCurrentView("wallet");

  useEffect(() => {
    if (currentView !== "receive") return;

    // Save the previously focused element
    previousFocusRef.current = document.activeElement as HTMLElement;

    // Focus the first focusable element (close button) when modal opens
    const timer = setTimeout(() => {
      firstFocusableRef.current?.focus();
    }, 0);

    // Handle Escape key
    const handleEscape = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
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
  }, [currentView, setCurrentView]);

  // Focus trap: keep focus within modal
  useEffect(() => {
    if (currentView !== "receive" || !modalRef.current) return;

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
  }, [currentView]);

  if (currentView !== "receive") return null;

  const handleChainChange = (chain: Chain) => {
    setSelectedChain(chain);
    setActiveChain(chain);
  };
  const [copied, setCopied] = useState(false);
  const [showQr, setShowQr] = useState(false);

  let actualEvmAddress = manualWalletState.address;
  let actualSolAddress = manualWalletState.solanaAddress;

  if (user?.linkedAccounts?.length) {
    // Find embedded or linked EVM wallet
    const evmAccount = user.linkedAccounts.find(
      (acc) =>
        acc.type === "wallet" &&
        (acc as any).chainType === "ethereum" && // safe cast – Privy still ships untyped chainType in 3.8.x
        typeof (acc as any).address === "string"
    );

    // Find embedded or linked Solana wallet
    const solanaAccount = user.linkedAccounts.find(
      (acc) =>
        acc.type === "wallet" &&
        (acc as any).chainType === "solana" &&
        typeof (acc as any).address === "string"
    );

    if (
      evmAccount &&
      "address" in evmAccount &&
      typeof evmAccount.address === "string"
    ) {
      actualEvmAddress = evmAccount.address;
    }

    if (
      solanaAccount &&
      "address" in solanaAccount &&
      typeof solanaAccount.address === "string"
    ) {
      actualSolAddress = solanaAccount.address;
    }
  }

  const address =
    selectedChain === "EVM" ? actualEvmAddress : actualSolAddress;

  if (!address) {
    return (
      <div
        className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
        role="dialog"
        aria-modal="true"
        aria-labelledby="receive-modal-title"
      >
        <div
          className="relative w-full max-w-md m-6 bg-white dark:bg-[color:var(--color-surface)] rounded-lg shadow-xl p-6"
          role="document"
        >
          <p className="text-center">Wallet address not available</p>
        </div>
      </div>
    );
  }
  const handleCopy = async () => {
    await navigator.clipboard.writeText(address);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center"
      role="dialog"
      aria-modal="true"
      aria-labelledby="receive-modal-title"
    >
      <div
        ref={modalRef}
        className="relative w-full max-w-md m-6 bg-[color:var(--color-surface)] rounded-lg shadow-xl p-6 animate-in fade-in-0"
        role="document"
      >
        <button
          ref={firstFocusableRef}
          onClick={handleClose}
          className="absolute top-4 right-4 rounded-lg p-1.5 hover:bg-black/10 transition"
          aria-label="Close modal"
        >
          <X className="h-5 w-5 text-[color:var(--color-depth)]" />
        </button>
        <h2 id="receive-modal-title" className="text-xl font-bold mb-6">
          Receive
        </h2>
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
                  onClick={() => handleChainChange(chain)}
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
      </div>
    </div>
  );
}

