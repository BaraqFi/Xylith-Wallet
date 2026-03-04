import React, { useState } from 'react';
import { SpendingLimit, WalletState } from '@/lib/ai/types';
import { X, Eye, EyeOff, Save, Key, PenTool, CheckCircle, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';

interface SettingsModalProps {
  onClose: () => void;
  spendingLimit: SpendingLimit;
  onUpdateLimit: (limit: SpendingLimit) => void;
  wallet: WalletState;
}

/**
 * Modal dialog for configuring application settings.
 */
export const AiSettingsModal: React.FC<SettingsModalProps> = ({
  onClose, spendingLimit, onUpdateLimit, wallet
}) => {
  const [showKeys, setShowKeys] = useState(false);
  const [amount, setAmount] = useState(spendingLimit.amount);
  const [period, setPeriod] = useState(spendingLimit.period);
  const [defaultBuy, setDefaultBuy] = useState(spendingLimit.defaultBuyAmountUSD || 50);
  const [isSigned, setIsSigned] = useState(false);
  const hasChanges =
    amount !== spendingLimit.amount ||
    period !== spendingLimit.period ||
    defaultBuy !== (spendingLimit.defaultBuyAmountUSD || 50);

  const handleSave = () => {
    onUpdateLimit({
      ...spendingLimit,
      amount: Number(amount),
      period,
      defaultBuyAmountUSD: Number(defaultBuy)
    });
    onClose();
  };

  const handleSignAllowance = () => {
    // Simulate on-chain signing delay
    setTimeout(() => {
      setIsSigned(true);
    }, 1000);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-card rounded-2xl w-full max-w-md transform transition-all scale-100 text-[color:var(--color-depth)]">

        {/* Header */}
        <div className="flex justify-between items-center p-6 border-b border-[color:var(--color-border)]">
          <h2 className="text-xl font-bold text-[color:var(--color-depth)] flex items-center gap-2">
            Settings
          </h2>
          <button onClick={onClose} className="text-[color:var(--color-depth)]/60 hover:text-[color:var(--color-depth)] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="p-6 space-y-8 max-h-[70vh] overflow-y-auto custom-scrollbar">

          {/* Spending Limits Section */}
          <div className="relative border border-[color:var(--color-border)] rounded-xl p-4 bg-[color:var(--color-depth)]/5">
            <div className="absolute -top-3 left-3 glass-card px-2 py-0.5 text-xs font-semibold text-[color:var(--color-accent)] uppercase tracking-wider flex items-center gap-1 rounded-md">
              <ShieldCheck size={12} /> Allowance Protocol
            </div>

            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-xs text-[color:var(--color-depth)]/60 mb-1">Max Spend (USD)</label>
                  <input
                    type="number"
                    value={amount}
                    onChange={(e) => setAmount(Number(e.target.value))}
                    className="w-full bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg px-4 py-2 text-[color:var(--color-depth)] focus:ring-2 focus:ring-[color:var(--color-accent)]/30 outline-none transition-all"
                  />
                </div>
                <div>
                  <label className="block text-xs text-[color:var(--color-depth)]/60 mb-1">Default Buy (USD)</label>
                  <input
                    type="number"
                    value={defaultBuy}
                    onChange={(e) => setDefaultBuy(Number(e.target.value))}
                    className="w-full bg-[color:var(--color-surface)] border border-[color:var(--color-border)] rounded-lg px-4 py-2 text-[color:var(--color-depth)] focus:ring-2 focus:ring-[color:var(--color-accent)]/30 outline-none transition-all"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs text-[color:var(--color-depth)]/60 mb-1">Reset Period</label>
                <div className="flex bg-[color:var(--color-depth)]/5 p-1 rounded-lg border border-[color:var(--color-border)]">
                  <button
                    onClick={() => setPeriod('DAILY')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${period === 'DAILY' ? 'bg-[color:var(--color-accent)]/20 text-[color:var(--color-depth)] shadow' : 'text-[color:var(--color-depth)]/60 hover:text-[color:var(--color-depth)]'}`}
                  >
                    Daily
                  </button>
                  <button
                    onClick={() => setPeriod('WEEKLY')}
                    className={`flex-1 py-1.5 text-xs font-medium rounded-md transition-all ${period === 'WEEKLY' ? 'bg-[color:var(--color-accent)]/20 text-[color:var(--color-depth)] shadow' : 'text-[color:var(--color-depth)]/60 hover:text-[color:var(--color-depth)]'}`}
                  >
                    Weekly
                  </button>
                </div>
              </div>

              {/* On-Chain Signing Simulation */}
              <div className="pt-2 border-t border-[color:var(--color-border)]">
                <button
                  onClick={handleSignAllowance}
                  disabled={isSigned}
                  className={clsx(
                    "w-full py-2 border rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all mt-2",
                    isSigned
                      ? "bg-[color:var(--color-accent)]/15 border-[color:var(--color-accent)]/30 text-[color:var(--color-depth)] cursor-default"
                      : "bg-[color:var(--color-depth)]/5 border-[color:var(--color-border)] text-[color:var(--color-depth)]/80 hover:bg-[color:var(--color-depth)]/10"
                  )}
                >
                  {isSigned ? <><CheckCircle size={14} /> Allowance & Period Signed</> : <><PenTool size={14} /> Sign New Allowance On-Chain</>}
                </button>
                <p className="text-[10px] text-[color:var(--color-depth)]/60 mt-2 text-center leading-relaxed">
                  Signing updates the smart contract spending limits for this session key.
                </p>
              </div>
            </div>
          </div>

          {/* Private Keys Section */}
          <div>
            <div className="flex justify-between items-center mb-4">
              <h3 className="text-sm font-semibold text-red-500 uppercase tracking-wider flex items-center gap-2">
                <Key size={14} /> Session Keys
              </h3>
              <button
                onClick={() => setShowKeys(!showKeys)}
                className="text-xs text-[color:var(--color-depth)]/60 hover:text-[color:var(--color-depth)] flex items-center gap-1"
              >
                {showKeys ? <><EyeOff size={12} /> Hide</> : <><Eye size={12} /> Reveal</>}
              </button>
            </div>

            <div className="space-y-3">
              <div className="bg-[color:var(--color-depth)]/5 rounded-lg p-3 border border-[color:var(--color-border)] relative group">
                <span className="absolute top-2 right-2 text-[10px] text-[color:var(--color-depth)]/40 font-bold">EVM</span>
                <p className={`font-mono text-xs break-all ${showKeys ? 'text-[color:var(--color-depth)]/80' : 'text-[color:var(--color-depth)]/30 blur-sm select-none'}`}>
                  {wallet.evmPrivateKey}
                </p>
              </div>
              <div className="bg-[color:var(--color-depth)]/5 rounded-lg p-3 border border-[color:var(--color-border)] relative group">
                <span className="absolute top-2 right-2 text-[10px] text-[color:var(--color-depth)]/40 font-bold">SOL</span>
                <p className={`font-mono text-xs break-all ${showKeys ? 'text-[color:var(--color-depth)]/80' : 'text-[color:var(--color-depth)]/30 blur-sm select-none'}`}>
                  {wallet.solPrivateKey}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-6 pt-0">
          <button
            onClick={handleSave}
            disabled={!hasChanges}
            className={clsx(
              "w-full py-3 rounded-lg font-medium transition-all shadow-lg flex items-center justify-center gap-2",
              hasChanges
                ? "bg-[color:var(--color-accent)] hover:brightness-95 text-[color:var(--color-depth)] translate-y-0"
                : "bg-[color:var(--color-depth)]/10 text-[color:var(--color-depth)]/50 cursor-not-allowed shadow-none"
            )}
          >
            <Save size={18} /> Save Preferences
          </button>
        </div>
      </div>
    </div>
  );
};
