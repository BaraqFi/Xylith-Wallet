"use client";

import { useEffect } from "react";
import { AppProvider, useApp } from "@/components/app/AppContext";
import { ModeToggle } from "@/components/app/ModeToggle";
import { AiModeAlert } from "@/components/ai/AiModeAlert";
import ManualWallet from "@/components/wallet/ManualWallet";
import { SendFlow } from "@/components/send/SendFlow";
import { SwapFlow } from "@/components/swap/SwapFlow";
import { ReceiveScreen } from "@/components/receive/ReceiveModal";
import { HistoryScreen } from "@/components/history/HistoryScreen";
import { TransactionReceipt } from "@/components/history/TransactionReceipt";
import { AiModePage } from "@/components/ai/AiModePage";
import { WalletSettingsScreen } from "@/components/wallet/WalletSettingsModal";
import { TokenDetailsView } from "@/components/wallet/TokenDetailsView";
import AuthGate from "./AuthGate";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { defaultEvmTokens, defaultSolanaTokens, TokenBalance } from "@/components/wallet/data";

function WalletContent() {
  const { mode, currentView, activeChain, selectedTokenDetails } = useApp();

  // Both chains are fetched, not just the active one: the send flow's chain
  // filter and the cross-chain token list need real balances for both, and
  // filling the inactive chain from the zero-balance defaults made "All" look
  // like the user held nothing there.
  const {
    balances: evmBalances,
    isLoading: isLoadingEvm,
    refresh: refreshEvmBalances,
  } = useTokenBalances('EVM', 'ethereum');
  const {
    balances: solBalances,
    isLoading: isLoadingSol,
    refresh: refreshSolBalances,
  } = useTokenBalances('Solana', 'ethereum');

  const realBalances = activeChain === 'EVM' ? evmBalances : solBalances;
  const isLoadingBalances = activeChain === 'EVM' ? isLoadingEvm : isLoadingSol;

  /** Re-read balances on both chains — called after a transaction settles. */
  const refreshAllBalances = () => {
    refreshEvmBalances();
    refreshSolBalances();
  };

  // FIX: Merge logic to ensure we always have both EVM and Solana tokens available
  // regardless of which chain is "active". This enables the "Send" flow to see all tokens
  // and the "Token List" to show cross-chain holdings (stacked logos).

  const allTokens: TokenBalance[] = [];

  if (activeChain === 'EVM') {
    // ACTIVE: EVM
    // 1. Process EVM from realBalances
    if (realBalances.length > 0) {
      const balanceMap = new Map<string, TokenBalance>();
      realBalances.forEach(t => {
        // Construct a unique key for matching. 
        // Priority: contractAddress (lower) -> symbol-chain
        if (t.contractAddress) {
          balanceMap.set(t.contractAddress.toLowerCase(), t);
        } else {
          // Fallback for native/address-less tokens
          balanceMap.set(`${t.symbol}-${t.evmChain}`, t);
        }
      });

      const processedRealTokens = new Set<string>();

      const mergedEvmTokens = defaultEvmTokens.map(defToken => {
        let match = null;
        // Try address match
        if (defToken.contractAddress) {
          const key = defToken.contractAddress.toLowerCase();
          match = balanceMap.get(key);
          if (match && match.evmChain === defToken.evmChain) {
            processedRealTokens.add(key);
            return match;
          }
        }

        // Try fallback match (symbol-chain) if no address match confirmed
        const fallbackKey = `${defToken.symbol}-${defToken.evmChain}`;
        if (!match) {
          match = balanceMap.get(fallbackKey);
          if (match) {
            processedRealTokens.add(fallbackKey);
            // Also add address key if it exists on the match to prevent double adding
            if (match.contractAddress) processedRealTokens.add(match.contractAddress.toLowerCase());
            return match;
          }
        }

        return defToken;
      });

      allTokens.push(...mergedEvmTokens);

      // Add discovered tokens that were NOT used (not in defaults)
      realBalances.forEach(t => {
        const addrKey = t.contractAddress ? t.contractAddress.toLowerCase() : null;
        const symKey = `${t.symbol}-${t.evmChain}`;

        const isProcessed = (addrKey && processedRealTokens.has(addrKey)) || processedRealTokens.has(symKey);

        if (!isProcessed) {
          allTokens.push(t);
        }
      });
    } else {
      // Fallback if loading or error
      allTokens.push(...defaultEvmTokens);
    }

    // FINAL SAFETY DEDUPLICATION
    const uniqueTokens = new Map<string, TokenBalance>();

    const getTokenKey = (token: TokenBalance): string => {
      const isNative = !token.contractAddress || token.contractAddress.toLowerCase() === '0xeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeeee';
      const chainKey = token.evmChain || token.chain;
      if (isNative) {
        // For native tokens, key by symbol and chain. This handles native tokens on different chains (e.g. ETH on Ethereum, ETH on Base)
        return `${token.symbol.toUpperCase()}-${chainKey}`;
      }
      return `${token.contractAddress!.toLowerCase()}-${chainKey}`;
    }

    allTokens.forEach(t => {
      const key = getTokenKey(t);

      const existing = uniqueTokens.get(key);
      if (!existing || (existing.amount === 0 && t.amount > 0)) {
        uniqueTokens.set(key, t);
      }
    });

    // Clear and refill (hacky but safe for this scope)
    allTokens.length = 0;
    allTokens.push(...Array.from(uniqueTokens.values()));

    // 2. Solana holdings (real, even though it is the inactive chain)
    allTokens.push(...(solBalances.length > 0 ? solBalances : defaultSolanaTokens));

  } else {
    // ACTIVE: Solana
    // 1. EVM holdings (real, even though it is the inactive chain)
    allTokens.push(...(evmBalances.length > 0 ? evmBalances : defaultEvmTokens));

    // 2. Process Solana from realBalances
    // useTokenBalances(Solana) returns the fully merged list (Defaults + Discovered)
    if (realBalances.length > 0) {
      allTokens.push(...realBalances);
    } else {
      allTokens.push(...defaultSolanaTokens);
    }
  }

  if (mode === "ai") {
    return <AiModePage />;
  }
  if (currentView === "token-details") {
    if (selectedTokenDetails) {
      return <TokenDetailsView token={selectedTokenDetails} allTokens={allTokens} />;
    }
  }
  if (currentView === "send") {
    // Pass ALL tokens to SendFlow so it can filter by chain
    return <SendFlow tokens={allTokens} onTransactionSettled={refreshAllBalances} />;
  }
  if (currentView === "swap") {
    return <SwapFlow onTransactionSettled={refreshAllBalances} />;
  }
  if (currentView === "history") {
    return <HistoryScreen />;
  }
  if (currentView === "receipt") {
    return <TransactionReceipt />;
  }
  // Pass ALL tokens to ManualWallet so it can group them (e.g. USDC on both chains)
  return <ManualWallet tokens={allTokens} isLoading={isLoadingBalances} />;
}

function ReceiveScreenWrapper() {
  const { currentView } = useApp();
  return currentView === "receive" ? <ReceiveScreen /> : null;
}

function SettingsScreenWrapper() {
  const { currentView } = useApp();
  return currentView === "settings" ? <WalletSettingsScreen /> : null;
}

function Header() {
  const { currentView } = useApp();
  const showToggles = currentView === "wallet";
  if (!showToggles) return null;
  return (
    <div className="mb-6 flex items-center justify-end">
      <div className="flex items-center gap-3">
        <ModeToggle />
      </div>
    </div>
  );
}

function BodyScrollManager() {
  const { currentView, mode } = useApp();

  useEffect(() => {
    const shouldLock = currentView === 'receive' || currentView === 'settings' || mode === 'ai';
    if (shouldLock) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
  }, [currentView, mode]);

  return null;
}

function HomeContent() {
  const { mode } = useApp();
  const isAi = mode === "ai";

  return (
    <AuthGate>
      <div className={isAi
        ? "h-[100dvh] bg-[color:var(--color-surface)] overflow-hidden"
        : "min-h-screen bg-[color:var(--color-surface)] px-4 py-6 sm:px-8 sm:py-10 overflow-y-auto no-scrollbar"
      }>
        <main className={isAi ? "h-full" : "mx-auto w-full"}>
          {!isAi && <Header />}
          <WalletContent />
          <ReceiveScreenWrapper />
          <SettingsScreenWrapper />
          <AiModeAlert />
        </main>
      </div>
    </AuthGate>
  );
}

function StatusBarShield() {
  return (
    <div
      className="fixed top-0 left-0 right-0 z-50 bg-[color:var(--color-surface)]"
      style={{ height: 'env(safe-area-inset-top)' }}
    />
  );
}

export default function Home() {
  return (
    <AppProvider>
      <StatusBarShield />
      <BodyScrollManager />
      <HomeContent />
    </AppProvider>
  );
}
