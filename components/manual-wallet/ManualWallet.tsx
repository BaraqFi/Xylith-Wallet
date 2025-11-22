"use client";

import { useState } from "react";
import {
  manualWalletState,
  Chain,
  ManualWalletState,
  WalletTransaction,
  TokenBalance,
  EVMChain,
} from "./data";
import { useApp } from "../app/AppContext";
import { shortenAddress } from "./utils";
import { TokenDetailsModal } from "./TokenDetailsModal";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const actionButtons = [
  { label: "Send", icon: "north", action: "send" },
  { label: "Receive", icon: "south", action: "receive" },
  { label: "Swap", icon: "swap", action: "swap" },
  { label: "History", icon: "clock", action: "history" },
] as const;

function formatAddress(address: ManualWalletState["address"]) {
  if (address.length <= 10) return address;
  return `${address.slice(0, 4)}…${address.slice(-3)}`;
}

function tokenAmountLabel(token: TokenBalance) {
  if (token.symbol === "USDC") {
    return `${token.amount.toLocaleString()} ${token.symbol}`;
  }
  return `${token.amount.toLocaleString(undefined, {
    maximumFractionDigits: 4,
  })} ${token.symbol}`;
}

const directionMap: Record<
  WalletTransaction["direction"],
  { badge: string; colorClass: string }
> = {
  in: { badge: "In", colorClass: "bg-[color:var(--color-accent)]/15" },
  out: { badge: "Out", colorClass: "bg-[color:var(--color-depth)]/10" },
  swap: { badge: "Swap", colorClass: "bg-[color:var(--color-depth)]/5" },
};

const actionIconMap: Record<string, JSX.Element> = {
  south: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        d="M12 4v14m0 0 4-4m-4 4-4-4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  north: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        d="M12 20V6m0 0-4 4m4-4 4 4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  swap: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        d="M7 10H4l3-3 3 3H7zm10 4h3l-3 3-3-3h3zM7 10h13M17 14H4"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
  clock: (
    <svg viewBox="0 0 24 24" className="h-5 w-5" aria-hidden>
      <path
        d="M12 7v5l3 1.5M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18Z"
        stroke="currentColor"
        strokeWidth="1.5"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </svg>
  ),
};

function ChainToggle({
  chains,
  activeChain,
  onChainChange,
}: {
  chains: ManualWalletState["chains"];
  activeChain: Chain;
  onChainChange: (chain: Chain) => void;
}) {
  return (
    <div className="flex items-center gap-2 rounded-full border border-[color:var(--color-border)] p-1">
      {chains.map((chain) => {
        const isActive = chain.label === activeChain;
        return (
          <button
            key={chain.label}
            type="button"
            onClick={() => onChainChange(chain.label)}
            className={[
              "rounded-full px-3 py-1 text-sm font-medium transition-colors",
              isActive
                ? "bg-[color:var(--color-accent)] text-white"
                : "text-[color:var(--color-depth)]/60",
            ].join(" ")}
            aria-pressed={isActive}
          >
            {chain.label}
          </button>
        );
      })}
    </div>
  );
}

function TokenLogo({ symbol, name }: { symbol: string; name: string }) {
  const firstLetter = symbol[0] || name[0] || "?";
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--color-accent)]/12 font-semibold text-[color:var(--color-accent)]">
      {firstLetter}
    </div>
  );
}

export function ChainLogo({ chain }: { chain: EVMChain | "solana" }) {
  const chainColors: Record<string, string> = {
    ethereum: "bg-blue-500",
    bsc: "bg-yellow-500",
    base: "bg-blue-400",
    arbitrum: "bg-cyan-500",
    optimism: "bg-red-500",
    polygon: "bg-purple-500",
    solana: "bg-purple-400",
  };

  const chainInitials: Record<string, string> = {
    ethereum: "ETH",
    bsc: "BSC",
    base: "BASE",
    arbitrum: "ARB",
    optimism: "OP",
    polygon: "MATIC",
    solana: "SOL",
  };

  return (
    <div
      className={`flex h-4 w-4 items-center justify-center rounded-full text-[8px] font-bold text-white ${chainColors[chain] || "bg-gray-500"}`}
      title={chain}
    >
      {chainInitials[chain]?.[0] || "?"}
    </div>
  );
}

function ManualActionButton({
  label,
  iconKey,
  action,
}: {
  label: string;
  iconKey: keyof typeof actionIconMap;
  action: string;
}) {
  const { setCurrentView } = useApp();

  const handleClick = () => {
    if (action === "send") {
      setCurrentView("send");
    } else if (action === "receive") {
      setCurrentView("receive");
    } else if (action === "history") {
      setCurrentView("history");
    } else if (action === "swap") {
      setCurrentView("swap");
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      className="flex flex-1 items-center justify-center gap-2 rounded-2xl border border-[color:var(--color-border)] px-4 py-3 text-sm font-semibold text-[color:var(--color-depth)] transition hover:border-[color:var(--color-accent)]"
    >
      <span className="text-[color:var(--color-accent)]">
        {actionIconMap[iconKey]}
      </span>
      {label}
    </button>
  );
}

function TokenList({
  tokens,
  activeChain,
  allTokens,
}: {
  tokens: ManualWalletState["tokens"];
  activeChain: Chain;
  allTokens: ManualWalletState["tokens"];
}) {
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
  const filteredTokens = tokens.filter((token) => token.chain === activeChain);

  return (
    <>
      <div className="wallet-card flex flex-col gap-4 p-6">
        <div className="flex items-center justify-between">
          <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-depth)]/65">
            Token list
          </p>
        </div>
        <div className="flex flex-col gap-4">
          {filteredTokens.length === 0 ? (
            <div className="py-8 text-center text-sm text-[color:var(--color-depth)]/60">
              No tokens on {activeChain}
            </div>
          ) : (
            filteredTokens.map((token) => (
              <button
                key={`${token.symbol}-${token.chain}${token.evmChain ? `-${token.evmChain}` : ""}`}
                onClick={() => setSelectedToken(token)}
                className="flex items-center justify-between rounded-2xl border border-[color:var(--color-border)] px-4 py-3 text-left transition hover:border-[color:var(--color-accent)]/30 hover:bg-[color:var(--color-depth)]/5"
              >
                <div className="flex items-center gap-3">
                  <TokenLogo symbol={token.symbol} name={token.name} />
                  <div className="flex items-center gap-2">
                    <div>
                      <p className="font-semibold">{token.name}</p>
                      <div className="flex items-center gap-2">
                        <p className="text-sm text-[color:var(--color-depth)]/60">
                          {tokenAmountLabel(token)}
                        </p>
                        {token.evmChain && activeChain === "EVM" && (
                          <ChainLogo chain={token.evmChain} />
                        )}
                      </div>
                    </div>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-semibold">
                    {currencyFormatter.format(token.usdValue)}
                  </p>
                  {token.deltaNote && (
                    <p className="text-sm text-[color:var(--color-depth)]/60">
                      {token.deltaNote}
                    </p>
                  )}
                </div>
              </button>
            ))
          )}
        </div>
      </div>
      {selectedToken && (
        <TokenDetailsModal
          token={selectedToken}
          allTokens={allTokens}
          onClose={() => setSelectedToken(null)}
        />
      )}
    </>
  );
}

function TransactionList({
  transactions,
  activeChain,
}: {
  transactions: ManualWalletState["transactions"];
  activeChain: Chain;
}) {
  const { setCurrentView, setSelectedTransactionId } = useApp();
  const filteredTransactions = transactions
    .filter((tx) => tx.chain === activeChain)
    .slice(0, 3);

  return (
    <div className="wallet-card flex flex-col gap-4 p-6">
      <div className="flex items-center justify-between">
        <p className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-depth)]/65">
          Recent transactions
        </p>
        <button
          onClick={() => setCurrentView("history")}
          className="text-xs font-semibold text-[color:var(--color-accent)] transition hover:opacity-80"
        >
          View All
        </button>
      </div>
      <div className="flex flex-col gap-4">
        {filteredTransactions.length === 0 ? (
          <div className="py-8 text-center text-sm text-[color:var(--color-depth)]/60">
            No transactions on {activeChain}
          </div>
        ) : (
          filteredTransactions.map((tx) => (
            <button
              key={tx.id}
              onClick={() => {
                setSelectedTransactionId(tx.id);
                setCurrentView("receipt");
              }}
              className="flex items-center justify-between rounded-2xl border border-[color:var(--color-border)] px-4 py-3 text-left transition hover:border-[color:var(--color-accent)]/30 hover:bg-[color:var(--color-depth)]/5"
            >
              <div className="flex items-center gap-3">
                <div
                  className={`flex h-10 w-10 items-center justify-center rounded-2xl text-sm font-semibold text-[color:var(--color-depth)] ${directionMap[tx.direction].colorClass}`}
                >
                  {tx.action}
                </div>
                <div>
                  <p className="font-semibold">{tx.token}</p>
                  <p className="text-sm text-[color:var(--color-depth)]/60">
                    {shortenAddress(tx.counterparty)}
                  </p>
                </div>
              </div>
              <div className="text-right">
                <p className="font-semibold">{tx.amountLabel}</p>
                <p className="text-sm text-[color:var(--color-depth)]/60">
                  {tx.timestampLabel}
                </p>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default function ManualWallet() {
  const {
    accountName,
    address,
    chains,
    tokens,
    transactions,
  } = manualWalletState;

  const [activeChain, setActiveChain] = useState<Chain>(manualWalletState.activeChain);

  const activeChainBalance = chains.find(
    (chain) => chain.label === activeChain,
  );

  return (
    <div className="flex flex-col gap-6 text-[color:var(--color-depth)]">
      <section className="wallet-card flex flex-col gap-6 p-6 md:p-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-col gap-2">
            <h1 className="text-2xl font-semibold">{accountName}</h1>
            <p className="text-sm text-[color:var(--color-depth)]/60">
              {formatAddress(address)}
            </p>
          </div>
          <ChainToggle chains={chains} activeChain={activeChain} onChainChange={setActiveChain} />
        </header>

        <div className="rounded-3xl border border-[color:var(--color-border)] p-6">
          <p className="text-sm text-[color:var(--color-depth)]/60">
            Available balance
          </p>
          <div className="mt-3">
            <p className="text-4xl font-semibold">
              {currencyFormatter.format(activeChainBalance?.currencyValue ?? 0)}
            </p>
            <p className="text-sm text-[color:var(--color-depth)]/60">
              {activeChainBalance?.nativeLabel}
            </p>
          </div>
          <div className="mt-6 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            {actionButtons.map((btn) => (
              <ManualActionButton
                key={btn.label}
                label={btn.label}
                iconKey={btn.icon}
                action={btn.action}
              />
            ))}
          </div>
        </div>
      </section>

      <div className="grid gap-6 lg:grid-cols-2">
        <TokenList tokens={tokens} activeChain={activeChain} allTokens={tokens} />
        <TransactionList transactions={transactions} activeChain={activeChain} />
      </div>
    </div>
  );
}

