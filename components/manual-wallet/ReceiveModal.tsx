"use client";

import { useState, useMemo } from "react";
import { useApp } from "../app/AppContext";
import { manualWalletState, Chain } from "./data";

function QRCodeGrid({ address }: { address: string }) {
  const grid = useMemo(() => {
    const seed = address.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0);
    return Array.from({ length: 64 }).map((_, i) => {
      const hash = (seed + i) % 100;
      return hash > 50;
    });
  }, [address]);

  return (
    <div className="grid grid-cols-8 gap-1 p-4">
      {grid.map((isDark, i) => (
        <div
          key={i}
          className={`aspect-square rounded ${
            isDark ? "bg-[color:var(--color-depth)]" : "bg-transparent"
          }`}
        />
      ))}
    </div>
  );
}

export function ReceiveModal() {
  const { setCurrentView } = useApp();
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

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-[color:var(--color-depth)]/40 p-4">
      <div className="wallet-card max-w-md w-full p-8">
        <div className="mb-6 flex items-center justify-between">
          <h2 className="text-2xl font-semibold text-[color:var(--color-depth)]">Receive</h2>
          <button
            onClick={() => setCurrentView("wallet")}
            className="text-[color:var(--color-depth)]/60 hover:text-[color:var(--color-depth)]"
          >
            <svg viewBox="0 0 24 24" className="h-6 w-6" fill="none" stroke="currentColor">
              <path d="M18 6L6 18M6 6l12 12" strokeLinecap="round" strokeLinejoin="round" />
            </svg>
          </button>
        </div>

        <div className="space-y-6">
          <div>
            <label className="mb-2 block text-sm font-medium text-[color:var(--color-depth)]">
              Select Network
            </label>
            <div className="flex gap-2 rounded-full border border-[color:var(--color-depth)]/10 p-1">
              {(["EVM", "Solana"] as Chain[]).map((chain) => (
                <button
                  key={chain}
                  type="button"
                  onClick={() => setSelectedChain(chain)}
                  className={`flex-1 rounded-full px-4 py-2 text-sm font-medium transition ${
                    selectedChain === chain
                      ? "bg-[color:var(--color-accent)] text-white"
                      : "text-[color:var(--color-depth)]/60"
                  }`}
                >
                  {chain}
                </button>
              ))}
            </div>
          </div>

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => setShowQr(false)}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                !showQr
                  ? "bg-[color:var(--color-accent)] text-white"
                  : "border border-[color:var(--color-depth)]/10 text-[color:var(--color-depth)]"
              }`}
            >
              Address
            </button>
            <button
              type="button"
              onClick={() => setShowQr(true)}
              className={`flex-1 rounded-xl px-4 py-2 text-sm font-semibold transition ${
                showQr
                  ? "bg-[color:var(--color-accent)] text-white"
                  : "border border-[color:var(--color-depth)]/10 text-[color:var(--color-depth)]"
              }`}
            >
              QR Code
            </button>
          </div>

          {showQr ? (
            <div className="flex flex-col items-center gap-4 rounded-2xl border border-[color:var(--color-depth)]/10 p-8">
              <div className="flex h-64 w-64 items-center justify-center rounded-2xl border-4 border-[color:var(--color-depth)]/10 bg-white">
                <div className="flex h-full w-full items-center justify-center">
                  <QRCodeGrid address={address} />
                </div>
              </div>
              <p className="text-sm text-[color:var(--color-depth)]/60">
                Scan this QR code to receive {selectedChain} assets
              </p>
            </div>
          ) : (
            <div className="space-y-4">
              <div className="rounded-2xl border border-[color:var(--color-depth)]/10 bg-[color:var(--color-depth)]/5 p-4">
                <p className="mb-2 text-sm text-[color:var(--color-depth)]/60">
                  Your {selectedChain} address
                </p>
                <p className="break-all font-mono text-sm">{address}</p>
              </div>
              <button
                onClick={handleCopy}
                className="w-full rounded-xl border border-[color:var(--color-accent)] bg-[color:var(--color-accent)]/10 px-4 py-3 text-sm font-semibold text-[color:var(--color-accent)] transition hover:bg-[color:var(--color-accent)]/20"
              >
                {copied ? "Copied!" : "Copy Address"}
              </button>
            </div>
          )}

          <div className="rounded-2xl border border-yellow-200 bg-yellow-50 p-4">
            <p className="text-sm text-yellow-800">
              Only send {selectedChain} assets to this address. Sending other assets may result in
              permanent loss.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}

