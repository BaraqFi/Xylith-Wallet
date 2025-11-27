"use client";

import { useState, useEffect } from "react";
import { AppProvider, useApp } from "@/components/app/AppContext";
import { ModeToggle } from "@/components/app/ModeToggle";
import { AiModeAlert } from "@/components/app/AiModeAlert";
import { SplashScreen } from "@/components/app/SplashScreen";
import ManualWallet from "@/components/manual-wallet/ManualWallet";
import { SendFlow } from "@/components/manual-wallet/SendFlow";
import { SwapFlow } from "@/components/manual-wallet/SwapFlow";
import { ReceiveModal } from "@/components/manual-wallet/ReceiveModal";
import { HistoryScreen } from "@/components/manual-wallet/HistoryScreen";
import { TransactionReceipt } from "@/components/manual-wallet/TransactionReceipt";
import { AiModePage } from "@/components/manual-wallet/AiModePage";
import { WalletSettingsModal } from "@/components/manual-wallet/WalletSettingsModal";
import AuthGate from "./AuthGate";

function WalletContent() {
  const { mode, currentView } = useApp();

  if (mode === "ai") {
    return <AiModePage />;
  }

  if (currentView === "send") {
    return <SendFlow />;
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

  return <ManualWallet />;
}

function ReceiveModalWrapper() {
  const { currentView } = useApp();
  if (currentView === "receive") {
    return <ReceiveModal />;
  }
  return null;
}

function SettingsModalWrapper() {
  const { currentView } = useApp();
  if (currentView === "settings") {
    return <WalletSettingsModal />;
  }
  return null;
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

function HomeContent() {
  // previously: inserted LoginWithEmailAndGoogle or splash
  return (
    <AuthGate>
      <div className="min-h-screen bg-[color:var(--color-surface)] px-4 py-6 sm:px-8 sm:py-10">
        <main className="mx-auto w-full">
          <Header />
          <WalletContent />
          <ReceiveModalWrapper />
          <SettingsModalWrapper />
          <AiModeAlert />
        </main>
      </div>
    </AuthGate>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <HomeContent />
    </AppProvider>
  );
}
