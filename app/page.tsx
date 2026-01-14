"use client";

import { useState, useEffect } from "react";
import { AppProvider, useApp } from "@/components/app/AppContext";
import { ModeToggle } from "@/components/app/ModeToggle";
import { AiModeAlert } from "@/components/ai/AiModeAlert";
import { SplashScreen } from "@/components/app/SplashScreen";
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
import { defaultEvmTokens, defaultSolanaTokens } from "@/components/wallet/data";

function WalletContent() {
  const { mode, currentView, activeChain, selectedTokenDetails } = useApp();

  // Lift useTokenBalances to the common ancestor
  // A more advanced implementation might pass the specific evmChain from context
  const { balances: realBalances, isLoading: isLoadingBalances } = useTokenBalances(
    activeChain,
    'ethereum' // Defaulting to ethereum for the hook
  );

  // FIX: Merge logic to ensure we always have both EVM and Solana tokens available
  // regardless of which chain is "active". This enables the "Send" flow to see all tokens
  // and the "Token List" to show cross-chain holdings (stacked logos).

  const allTokens: any[] = [];

  if (activeChain === 'EVM') {
    // ACTIVE: EVM
    // 1. Process EVM from realBalances
    if (realBalances.length > 0) {
      const balanceMap = new Map<string, any>();
      realBalances.forEach(t => {
        if (t.contractAddress) {
          balanceMap.set(t.contractAddress.toLowerCase(), t);
        } else if (t.symbol === "ETH" && t.evmChain === "ethereum") {
          // Handle native ETH specially if needed, though usually has 0x0...0 address in our data
          balanceMap.set("native-eth", t);
        }
      });

      const mergedEvmTokens = defaultEvmTokens.map(defToken => {
        // Match by address if available
        let match = null;
        if (defToken.contractAddress) {
          match = balanceMap.get(defToken.contractAddress.toLowerCase());
        }

        if (match && match.evmChain === defToken.evmChain) {
          return match;
        }
        return defToken;
      });

      allTokens.push(...mergedEvmTokens);

      // Add discovered tokens not in defaults
      realBalances.forEach(t => {
        const isDefault = defaultEvmTokens.some(d =>
          d.contractAddress?.toLowerCase() === t.contractAddress?.toLowerCase() &&
          d.evmChain === t.evmChain
        );
        if (!isDefault) {
          allTokens.push(t);
        }
      });
    } else {
      // Fallback if loading or error
      allTokens.push(...defaultEvmTokens);
    }

    // 2. Add Default Solana Tokens (since inactive)
    allTokens.push(...defaultSolanaTokens);

  } else {
    // ACTIVE: Solana
    // 1. Add Default EVM Tokens (since inactive)
    allTokens.push(...defaultEvmTokens); // If we wanted caching for inactive, we'd need separate stores.

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
    return <SendFlow tokens={allTokens} />;
  }
  if (currentView === "swap") {
    return <SwapFlow />;
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
  const { currentView } = useApp();

  useEffect(() => {
    const isModalOpen = currentView === 'receive' || currentView === 'settings';
    if (isModalOpen) {
      document.body.classList.add('overflow-hidden');
    } else {
      document.body.classList.remove('overflow-hidden');
    }
  }, [currentView]);

  return null;
}

function HomeContent() {
  return (
    <AuthGate>
      <div className="min-h-screen bg-[color:var(--color-surface)] px-4 py-6 sm:px-8 sm:py-10">
        <main className="mx-auto w-full">
          <Header />
          <WalletContent />
          <ReceiveScreenWrapper />
          <SettingsScreenWrapper />
          <AiModeAlert />
        </main>
      </div>
    </AuthGate>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <BodyScrollManager />
      <HomeContent />
    </AppProvider>
  );
}
