"use client";

import { useState, type ElementType } from "react";
import {
  Copy,
  QrCode,
  Check,
  ArrowUp,
  ArrowDown,
  ArrowRightLeft,
  History,
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
// Web3Icons for token and network logos
import * as Web3Icons from "@web3icons/react";

// Hexagonal Avatar Component
function HexagonalAvatar({ 
  children, 
  className = "" 
}: { 
  children: React.ReactNode; 
  className?: string;
}) {
  return (
    <div className={`relative ${className}`} style={{ width: '40px', height: '40px' }}>
      <svg
        className="absolute inset-0"
        viewBox="0 0 40 40"
        xmlns="http://www.w3.org/2000/svg"
      >
        <polygon
          points="20,2 35,10 35,30 20,38 5,30 5,10"
          fill="currentColor"
          className="text-[color:var(--color-accent)]/20"
        />
      </svg>
      <div className="absolute inset-0 flex items-center justify-center">
        {children}
      </div>
    </div>
  );
}

const currencyFormatter = new Intl.NumberFormat("en-US", {
  style: "currency",
  currency: "USD",
  minimumFractionDigits: 2,
});


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
    <div className="flex items-center gap-1 rounded-full border border-[color:var(--color-border)] p-1">
      {chains.map((chain) => {
        const isActive = chain.label === activeChain;
        return (
          <Button
            key={chain.label}
            variant={isActive ? "default" : "ghost"}
            size="sm"
            onClick={() => onChainChange(chain.label)}
            className="flex-1 rounded-full"
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
  size = "md",
}: {
  symbol: string;
  name: string;
  size?: "sm" | "md" | "lg";
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

  const sizeMap = {
    sm: { container: "h-6 w-6", icon: 24, text: "text-xs" },
    md: { container: "h-10 w-10", icon: 40, text: "text-sm" },
    lg: { container: "h-12 w-12", icon: 48, text: "text-base" },
  };

  const sizes = sizeMap[size];

  const iconName = tokenIconMap[symbol];
  // @ts-expect-error - Dynamic access to Web3Icons
  const IconComponent = iconName ? Web3Icons[iconName] : null;

  if (IconComponent) {
    return (
      <div className={`flex ${sizes.container} items-center justify-center rounded-2xl bg-[color:var(--color-accent)]/12`}>
        <IconComponent variant="branded" size={sizes.icon} />
      </div>
    );
  }

  // Fallback to initial letter if icon not found
  return (
    <div className={`flex ${sizes.container} items-center justify-center rounded-2xl bg-[color:var(--color-accent)]/12 font-semibold ${sizes.text} text-[color:var(--color-accent)]`}>
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
      <div className="flex h-4 w-4 items-center justify-center overflow-hidden" title={chain}>
        <IconComponent variant="branded" size={16} className="h-4 w-4" />
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


function TokenList({
  tokens,
  activeChain,
  allTokens,
}: {
  tokens: ManualWalletState["tokens"];
  activeChain: Chain;
  allTokens: ManualWalletState["tokens"];
}) {
  const { setCurrentView } = useApp();
  const [selectedToken, setSelectedToken] = useState<TokenBalance | null>(null);
  const filteredTokens = tokens.filter((token) => token.chain === activeChain);
  const displayTokens = filteredTokens.slice(0, 7);
  const hasMore = filteredTokens.length > 7;

  return (
    <>
      <div className="wallet-card flex flex-col gap-4 p-4 sm:p-6">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-depth)]/65 px-2">
          Token List
        </h2>
        {filteredTokens.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-12 gap-4 px-2">
            <p className="text-sm text-[color:var(--color-depth)]/60 text-center">
              No tokens found. Make a Deposit
            </p>
            <Button
              onClick={() => setCurrentView("receive")}
              className="bg-[color:var(--color-accent)] text-white hover:bg-[color:var(--color-accent)]/90"
            >
              Deposit
            </Button>
          </div>
        ) : (
          <div className="flex flex-col gap-2 max-h-[400px] overflow-y-auto px-2">
            {displayTokens.map((token) => (
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
            ))}
            {hasMore && (
              <p className="text-xs text-center text-[color:var(--color-depth)]/60 py-2">
                Scroll to view more tokens
              </p>
            )}
          </div>
        )}
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
      <div className="flex flex-col gap-2 px-2">
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
                  {tx.direction === "swap" ? (
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${directionMap[tx.direction].colorClass}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  ) : (
                    <TokenLogo symbol={tx.tokenSymbol} name={tx.token} />
                  )}
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
  const { setCurrentView, activeChain, setActiveChain } = useApp();
  const {
    accountName,
    address,
    solanaAddress,
    chains,
    tokens,
    transactions,
  } = manualWalletState;
  const [copied, setCopied] = useState(false);

  const activeChainBalance = chains.find(
    (chain) => chain.label === activeChain,
  );

  const currentAddress = activeChain === "EVM" ? address : solanaAddress;

  const handleCopyAddress = async () => {
    await navigator.clipboard.writeText(currentAddress);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleQrClick = () => {
    setCurrentView("receive");
  };

  const handleSettingsClick = () => {
    setCurrentView("settings");
  };

  return (
    <div className="mx-auto w-full flex flex-col gap-4 p-4 md:p-6 text-[color:var(--color-depth)]">
      {/* Top Header: Wallet Name + Address + QR */}
      <div className="wallet-card flex items-center justify-between p-4 gap-4">
        <button
          onClick={handleSettingsClick}
          className="flex items-center gap-3 hover:opacity-80 transition-opacity"
        >
          <HexagonalAvatar>
            <span className="text-lg font-bold text-[color:var(--color-accent)]">
              {accountName[0]}
            </span>
          </HexagonalAvatar>
          <h1 className="text-lg font-semibold hidden md:block">{accountName}</h1>
        </button>
        <div className="flex items-center gap-2">
          <button
            onClick={handleCopyAddress}
            className="flex items-center gap-1.5 px-2 py-1 rounded-lg hover:bg-[color:var(--color-depth)]/5 transition-colors"
          >
            <p className="text-sm text-[color:var(--color-depth)]/80 font-mono">
              {shortenAddress(currentAddress)}
            </p>
            {copied ? (
              <Check className="h-4 w-4 text-green-500" />
            ) : (
              <Copy className="h-4 w-4 text-[color:var(--color-depth)]/60" />
            )}
          </button>
          <Button
            variant="ghost"
            size="icon"
            onClick={handleQrClick}
            className="h-8 w-8"
          >
            <QrCode className="h-4 w-4" />
          </Button>
        </div>
      </div>

      {/* Balance Container: EVM/Solana Toggle + Balance */}
      <div className="wallet-card flex flex-col gap-4 p-4">
        <ChainToggle chains={chains} activeChain={activeChain} onChainChange={setActiveChain} />
        <div>
          <p className="text-sm text-[color:var(--color-depth)]/60 mb-1">
            Available balance
          </p>
          <p className="text-3xl font-semibold">
            {currencyFormatter.format(activeChainBalance?.currencyValue ?? 0)}
          </p>
          <p className="text-sm text-[color:var(--color-depth)]/60 mt-1">
            {activeChainBalance?.nativeLabel}
          </p>
        </div>
      </div>

      {/* Action Buttons: Send, Receive, Swap, History */}
      <div className="wallet-card p-4">
        <div className="grid grid-cols-4 gap-2 sm:gap-3">
          <Button
            variant="ghost"
            onClick={() => setCurrentView("send")}
            className="flex flex-col items-center justify-center gap-2 h-20 rounded-2xl bg-[color:var(--color-accent)]/10 hover:bg-[color:var(--color-accent)]/20 border border-[color:var(--color-border)] transition-colors"
          >
            <ArrowUp className="h-5 w-5 text-[color:var(--color-accent)]" />
            <span className="text-sm font-medium text-[color:var(--color-depth)]">Send</span>
          </Button>
          <Button
            variant="ghost"
            onClick={() => setCurrentView("receive")}
            className="flex flex-col items-center justify-center gap-2 h-20 rounded-2xl bg-[color:var(--color-accent)]/10 hover:bg-[color:var(--color-accent)]/20 border border-[color:var(--color-border)] transition-colors"
          >
            <ArrowDown className="h-5 w-5 text-[color:var(--color-accent)]" />
            <span className="text-sm font-medium text-[color:var(--color-depth)]">Receive</span>
          </Button>
          <Button
            variant="ghost"
            onClick={() => setCurrentView("swap")}
            className="flex flex-col items-center justify-center gap-2 h-20 rounded-2xl bg-[color:var(--color-accent)]/10 hover:bg-[color:var(--color-accent)]/20 border border-[color:var(--color-border)] transition-colors"
          >
            <ArrowRightLeft className="h-5 w-5 text-[color:var(--color-accent)]" />
            <span className="text-sm font-medium text-[color:var(--color-depth)]">Swap</span>
          </Button>
          <Button
            variant="ghost"
            onClick={() => setCurrentView("history")}
            className="flex flex-col items-center justify-center gap-2 h-20 rounded-2xl bg-[color:var(--color-accent)]/10 hover:bg-[color:var(--color-accent)]/20 border border-[color:var(--color-border)] transition-colors"
          >
            <History className="h-5 w-5 text-[color:var(--color-accent)]" />
            <span className="text-sm font-medium text-[color:var(--color-depth)]">History</span>
          </Button>
        </div>
      </div>

      {/* Token List Container */}
      <TokenList tokens={tokens} activeChain={activeChain} allTokens={tokens} />

      {/* Recent Transactions Container */}
      <TransactionList transactions={transactions} activeChain={activeChain} />
    </div>
  );
}

