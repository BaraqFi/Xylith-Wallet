"use client";

import { useState, type ElementType, type ComponentType } from "react";
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
import { shortenAddress, groupTokensBySymbol, GroupedToken } from "./utils";

// Removed TokenDetailsModal import
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
// Web3Icons for token and network logos - optimized individual imports
import {
  TokenETH,
  TokenUSDC,
  TokenUSDT,
  TokenWBTC,
  TokenDAI,
  TokenARB,
  TokenOP,
  TokenMATIC,
  TokenBNB,
  TokenSOL,
  TokenRAY,
  TokenJUP,
} from "@web3icons/react";
import { usePrivy } from "@privy-io/react-auth";
import { useTransactionHistory } from "@/hooks/useTransactionHistory";
import { ChainLogo } from "./ChainLogo";
import { ChainSelectorSheet } from "./ChainSelectorSheet";

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
  unknown: {
    badge: "Unknown",
    colorClass: "bg-[color:var(--color-depth)]/10 text-[color:var(--color-depth)]/60",
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

import { TokenLogo } from "./TokenLogo";




function TokenList({
  groupedTokens,
  activeChain,
  allTokens,
  isLoading = false,
}: {
  groupedTokens: GroupedToken[];
  activeChain: Chain;
  allTokens: TokenBalance[];
  isLoading?: boolean;
}) {
  const { setCurrentView, setSelectedTokenDetails, setActiveChain } = useApp();
  // Removed local selectedToken state

  // Filter based on activeChain. A token group is shown if any of its chains match.
  // Additional filter for specific EVM chain if selected
  const [evmChainFilter, setEvmChainFilter] = useState<EVMChain | "all">("all");

  const filteredGroupedTokens = groupedTokens.filter(group => {
    // 1. Must have balance on the active chain type (EVM vs Solana)
    const hasActiveChainType = group.chains.some(chainToken => chainToken.chain === activeChain);
    if (!hasActiveChainType) return false;

    // 2. If EVM and filter is active, must have balance on that specific chain
    if (activeChain === "EVM" && evmChainFilter !== "all") {
      return group.chains.some(t => t.chain === "EVM" && t.evmChain === evmChainFilter);
    }

    return true;
  });

  // Calculate total value displayed
  // If filtered by specific chain, show value for that chain only? 
  // User asked for "display only assets on a particular supported chain".
  // So if I select "Arbitrum", I should only see Arbitrum assets.

  // Mapping for display
  const displayTokens = filteredGroupedTokens.map(group => {
    // If filtering by specific EVM chain, we might want to adjust the displayed "totalUsdValue" and "amount" 
    // to reflect ONLY that chain's portion.
    if (activeChain === "EVM" && evmChainFilter !== "all") {
      const chainToken = group.chains.find(t => t.evmChain === evmChainFilter);
      if (chainToken) {
        return {
          ...group,
          totalUsdValue: chainToken.usdValue || 0,
          amount: chainToken.amount, // This is just for display logic if we used it, but group has list.
          // We need to be careful. The list item displays specific chain logos.
          chains: [chainToken] // Only show this chain
        };
      }
    }
    return group;
  });



  return (
    <>
      <div className="wallet-card flex flex-col gap-4 p-4 sm:p-6">
        <div className="flex items-center justify-between px-2">
          <h2 className="text-sm font-semibold uppercase tracking-wide text-[color:var(--color-depth)]/65">
            Token List
          </h2>
          <ChainSelectorSheet
            selectedChain={activeChain}
            selectedEvmChain={evmChainFilter}
            tokens={allTokens}
            includeAllOption={true}
            onSelectChain={(chain, evmChain) => {
              if (chain === "Solana") {
                setActiveChain("Solana");
                // When switching to Solana, filter is irrelevant/reset?
                // Or we keep it "all" for when we switch back.
              } else {
                setActiveChain("EVM");
                if (evmChain) setEvmChainFilter(evmChain as any);
              }
            }}
            trigger={
              <Button variant="outline" className="h-8 gap-2 rounded-full px-3 border-[color:var(--color-border)] bg-transparent hover:bg-[color:var(--color-depth)]/5 text-xs">
                <span className="font-medium">
                  {activeChain === "Solana"
                    ? "Solana"
                    : (evmChainFilter === "all" ? "All Networks" : evmChainFilter.charAt(0).toUpperCase() + evmChainFilter.slice(1))}
                </span>
                <ArrowDown className="h-3 w-3 opacity-50" />
              </Button>
            }
          />
        </div>
        {isLoading ? (
          <div className="flex flex-col items-center justify-center py-8 gap-3 px-2 text-[color:var(--color-depth)]/70">
            <div className="h-10 w-10 animate-spin rounded-full border-2 border-[color:var(--color-accent)] border-t-transparent" />
            <p className="text-sm">Loading balances…</p>
          </div>
        ) : filteredGroupedTokens.length === 0 ? (
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
            {displayTokens.map((group) => {
              // Find the first chain token with a logo, or use the group logo
              const logoToken = group.chains.find(t => t.logo) || group.chains[0];
              const logoUrl = logoToken?.logo || group.logo || undefined;
              
              return (
                <button
                  key={group.symbol}
                  onClick={() => {
                    setSelectedTokenDetails(group.chains[0]);
                    setCurrentView("token-details");
                  }}
                  className="flex items-center justify-between rounded-xl px-4 py-3 text-left transition-colors hover:bg-[color:var(--color-depth)]/5"
                >
                  <div className="flex items-center gap-3">
                    <TokenLogo
                      symbol={group.symbol}
                      name={group.name}
                      src={logoUrl}
                    />
                    <div className="flex flex-col">
                      <p className="font-semibold">{group.name}</p>
                      <div className="flex items-center gap-1 -space-x-2">
                        {group.chains.map(chainToken =>
                          chainToken.evmChain && chainToken.chain === activeChain ? (
                            <ChainLogo key={chainToken.evmChain} chain={chainToken.evmChain} />
                          ) : null
                        )}
                        {group.chains.some(ct => ct.chain === 'Solana' && activeChain === 'Solana') && (
                          <ChainLogo chain="solana" />
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="text-right">
                    <p className="font-semibold">
                      {currencyFormatter.format(group.totalUsdValue)}
                    </p>
                    <p className="text-sm text-[color:var(--color-depth)]/60">
                      {group.chains.reduce((sum, t) => sum + t.amount, 0).toLocaleString(undefined, {
                        maximumFractionDigits: 4,
                      })} {group.symbol}
                    </p>
                  </div>
                </button>
              );
            })}
            {/* Scroll indicator removed */}
          </div>
        )}
      </div>
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

export default function ManualWallet({ tokens, isLoading }: { tokens: TokenBalance[], isLoading: boolean }) {
  const { setCurrentView, activeChain, setActiveChain } = useApp();
  const {
    accountName,
    address,
    solanaAddress,
    chains,
  } = manualWalletState;
  const [copied, setCopied] = useState(false);
  const { user } = usePrivy();

  // The tokens and isLoading state are now passed as props.
  const displayTokens = tokens;
  const groupedTokens = groupTokensBySymbol(displayTokens);

  let actualEvmAddress = address;
  let actualSolAddress = solanaAddress;

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

    if (evmAccount && "address" in evmAccount && typeof evmAccount.address === "string") {
      actualEvmAddress = evmAccount.address;
    }

    if (solanaAccount && "address" in solanaAccount && typeof solanaAccount.address === "string") {
      actualSolAddress = solanaAccount.address;
    }
  }

  const currentAddress = activeChain === "EVM" ? actualEvmAddress : actualSolAddress;

  const activeChainBalance = chains.find(
    (chain) => chain.label === activeChain,
  );

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
      <TokenList
        groupedTokens={groupedTokens}
        activeChain={activeChain}
        allTokens={displayTokens}
        isLoading={isLoading}
      />

      {/* Recent Transactions Container */}
      <RecentTransactionList activeChain={activeChain} />
    </div>
  );
}

function RecentTransactionList({ activeChain }: { activeChain: Chain }) {
  const { setCurrentView, setSelectedTransactionId } = useApp();
  // Default to Ethereum for EVM
  const { transactions, isLoading } = useTransactionHistory(activeChain, 'ethereum');

  const filteredTransactions = transactions.slice(0, 3);

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
        {isLoading ? (
          <div className="py-8 text-center text-sm text-[color:var(--color-depth)]/60">Loading...</div>
        ) : filteredTransactions.length === 0 ? (
          <div className="py-8 text-center text-sm text-[color:var(--color-depth)]/60">
            No transactions on {activeChain}
          </div>
        ) : (
          filteredTransactions.map((tx) => {
            // Safe access to icon
            const Icon = directionMap[tx.direction]?.icon || ArrowRightLeft;
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
                    <div className={`flex h-10 w-10 items-center justify-center rounded-lg ${directionMap[tx.direction]?.colorClass || 'bg-gray-100'}`}>
                      <Icon className="h-5 w-5" />
                    </div>
                  ) : (
                    <TokenLogo symbol={tx.tokenSymbol || "?"} name={tx.token || "Unknown"} />
                  )}
                  <div>
                    <p className="font-semibold">{tx.token || "Unknown"}</p>
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

