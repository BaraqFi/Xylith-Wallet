"use client";

import { AppProvider, useApp } from "@/components/app/AppContext";
import { ModeToggle } from "@/components/app/ModeToggle";
import { DarkModeToggle } from "@/components/app/DarkModeToggle";
import { AiModeAlert } from "@/components/app/AiModeAlert";
import ManualWallet from "@/components/manual-wallet/ManualWallet";
import { SendFlow } from "@/components/manual-wallet/SendFlow";
import { SwapFlow } from "@/components/manual-wallet/SwapFlow";
import { ReceiveModal } from "@/components/manual-wallet/ReceiveModal";
import { HistoryScreen } from "@/components/manual-wallet/HistoryScreen";
import { TransactionReceipt } from "@/components/manual-wallet/TransactionReceipt";
import { AiModePage } from "@/components/manual-wallet/AiModePage";

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

function Header() {
  const { currentView } = useApp();
  const showToggles = currentView === "wallet";

  return (
    <div className="mb-6 flex items-center justify-between">
      <h1 className="text-2xl font-semibold text-[color:var(--color-depth)]">Xylith Wallet</h1>
      {showToggles && (
        <div className="flex items-center gap-3">
          <ModeToggle />
          <DarkModeToggle />
        </div>
      )}
    </div>
  );
}

export default function Home() {
  return (
    <AppProvider>
      <div className="min-h-screen bg-[color:var(--color-surface)] px-4 py-6 sm:px-8 sm:py-10">
        <main className="mx-auto max-w-5xl">
          <Header />
          <WalletContent />
          <ReceiveModalWrapper />
          <AiModeAlert />
        </main>
      </div>
    </AppProvider>
  );
}
