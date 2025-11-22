"use client";

import { useState, type ElementType } from "react";
import {
  ArrowUp,
  ArrowDown,
  ArrowRightLeft,
  History,
  Copy,
} from "lucide-react";
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
import { Button } from "@/components/ui/button";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
// Web3Icons for token and network logos
import * as Web3Icons from "@web3icons/react";

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});

const actionButtons = [
  { label: "Send", icon: ArrowUp, action: "send" },
  { label: "Receive", icon: ArrowDown, action: "receive" },
  { label: "Swap", icon: ArrowRightLeft, action: "swap" },
  { label: "History", icon: History, action: "history" },
] as const;

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
  { badge: string; colorClass: string; icon: ElementType }
> = {
  in: {
    badge: "In",
    colorClass: "bg-green-500/15 text-green-500",
    icon: ArrowDown,
  },
  out: {
    badge: "Out",
    colorClass: "bg-red-500/15 text-red-500",
    icon: ArrowUp,
  },
  swap: {
    badge: "Swap",
    colorClass: "bg-blue-500/15 text-blue-500",
    icon: ArrowRightLeft,
  },
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
          <Button
            key={chain.label}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            onClick={() => onChainChange(chain.label)}
            className="rounded-full"
          >
            {chain.label}
          </Button>
        );
      })}
    </div>
  );
}

export function TokenLogo({
  symbol,
  name,
}: {
  symbol: string;
  name: string;
}) {
  // Map token symbols to Web3Icons component names
  const tokenIconMap: Record<string, string> = {
    ETH: "TokenETH",
    USDC: "TokenUSDC",
    USDT: "TokenUSDT",
    WBTC: "TokenWBTC",
    DAI: "TokenDAI",
    ARB: "TokenARB",
    OP: "TokenOP",
    MATIC: "TokenMATIC",
    BNB: "TokenBNB",
    SOL: "TokenSOL",
    RAY: "TokenRAY",
    JUP: "TokenJUP",
  };

  const iconName = tokenIconMap[symbol];
  // @ts-expect-error - Dynamic access to Web3Icons
  const IconComponent = iconName ? Web3Icons[iconName] : null;

  if (IconComponent) {
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--color-accent)]/12">
        <IconComponent variant="branded" size={40} />
      </div>
    );
  }

  // Fallback to initial letter if icon not found
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-2xl bg-[color:var(--color-accent)]/12 font-semibold text-[color:var(--color-accent)]">
      {symbol[0] || name[0] || "?"}
    </div>
  );
}

export function ChainLogo({ chain }: { chain: EVMChain | "solana" }) {
  // Map chain names to Web3Icons Network component names
  const networkIconMap: Record<string, string> = {
    ethereum: "NetworkEthereum",
    bsc: "NetworkBSC",
    base: "NetworkBase",
    arbitrum: "NetworkArbitrum",
    optimism: "NetworkOptimism",
    polygon: "NetworkPolygon",
    solana: "NetworkSolana",
  };

  const iconName = networkIconMap[chain];
  // @ts-expect-error - Dynamic access to Web3Icons
  const IconComponent = iconName ? Web3Icons[iconName] : null;

  if (IconComponent) {
    return (
      <div className="flex h-4 w-4 items-center justify-center" title={chain}>
        <IconComponent variant="branded" size={16} />
      </div>
    );
  }

  // Fallback
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
  Icon,
  action,
}: {
  label: string;
  Icon: ElementType;
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
    <Button
      variant="outline"
      size="lg"
      onClick={handleClick}
      className="flex-1 justify-center gap-2"
    >
      <Icon className="h-4 w-4 text-[color:var(--color-accent)]" />
      <span>{label}</span>
    </Button>
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
      <div className="wallet-card flex flex-col gap-4 p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-depth)]/65 px-2">
          Token List
        </h2>
        <div className="flex flex-col gap-2">
          {filteredTokens.length === 0 ? (
            <div className="py-8 text-center text-sm text-[color:var(--color-depth)]/60">
              No tokens on {activeChain}
            </div>
          ) : (
            filteredTokens.map((token) => (
              <button
                key={`${token.symbol}-${token.chain}${token.evmChain ? `-${token.evmChain}` : ""}`}
                onClick={() => setSelectedToken(token)}
                className="flex items-center justify-between rounded-xl px-4 py-3 text-left transition-colors hover:bg-[color:var(--color-depth)]/5"
              >
                <div className="flex items-center gap-3">
                  <TokenLogo
                    symbol={token.symbol}
                    name={token.name}
                  />
                  <div className="flex flex-col">
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
    <div className="wallet-card flex flex-col gap-4 p-4 sm:p-6">
      <div className="flex items-center justify-between px-2">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-depth)]/65">
          Recent Transactions
        </h2>
        <Button
          variant="link"
          onClick={() => setCurrentView("history")}
          className="text-xs text-[color:var(--color-accent)]"
        >
          View All
        </Button>
      </div>
      <div className="flex flex-col gap-2">
        {filteredTransactions.length === 0 ? (
          <div className="py-8 text-center text-sm text-[color:var(--color-depth)]/60">
            No transactions on {activeChain}
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            const Icon = directionMap[tx.direction].icon;
            return (
              <button
                key={tx.id}
                onClick={() => {
                  setSelectedTransactionId(tx.id);
                  setCurrentView("receipt");
                }}
                className="flex items-center justify-between rounded-xl px-4 py-3 text-left transition-colors hover:bg-[color:var(--color-depth)]/5"
              >
                <div className="flex items-center gap-3">
                  <Avatar className="h-10 w-10 rounded-lg">
                    <AvatarFallback
                      className={`rounded-lg text-sm font-semibold ${
                        directionMap[tx.direction].colorClass
                      }`}
                    >
                      <Icon className="h-5 w-5" />
                    </AvatarFallback>
                  </Avatar>
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
            );
          })
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

  const handleCopyAddress = () => {
    navigator.clipboard.writeText(manualWalletState.address);
    // Add a toast notification here
  };

  return (
    <div className="mx-auto max-w-7xl w-full flex flex-col gap-6 p-4 md:p-6 text-[color:var(--color-depth)]">
      <section className="wallet-card flex flex-col gap-6 p-6 md:p-8">
        <header className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="h-12 w-12">
              <AvatarFallback className="bg-[color:var(--color-accent)]/20 text-[color:var(--color-accent)] text-xl font-bold">
                {accountName[0]}
              </AvatarFallback>
            </Avatar>
            <div className="flex flex-col gap-1">
              <h1 className="text-2xl font-semibold">{accountName}</h1>
              <div className="flex items-center gap-2">
                <p className="text-sm text-[color:var(--color-depth)]/60">
                  {shortenAddress(address)}
                </p>
                <Button variant="ghost" size="icon" onClick={handleCopyAddress} className="h-6 w-6">
                  <Copy className="h-4 w-4" />
                </Button>
              </div>
            </div>
          </div>
          <div className="shrink-0">
            <ChainToggle chains={chains} activeChain={activeChain} onChainChange={setActiveChain} />
          </div>
        </header>

        <div className="rounded-3xl bg-[color:var(--color-depth)]/5 p-6">
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
          <div className="mt-6 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {actionButtons.map((btn) => (
              <ManualActionButton
                key={btn.label}
                label={btn.label}
                Icon={btn.icon}
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

