import React, { useState } from 'react';
import { SpendingLimit } from '@/lib/ai/types';
import { X, Save, PenTool, CheckCircle, ShieldCheck } from 'lucide-react';
import clsx from 'clsx';

interface SettingsModalProps {
  onClose: () => void;
  spendingLimit: SpendingLimit;
  onUpdateLimit: (limit: SpendingLimit) => void;
  /** Re-grants session-key permissions on-chain with the given policy. */
  onApplyOnChain: (limit: SpendingLimit) => Promise<void>;
  /** Whether there is a session whose permissions can be replaced. */
  isSessionActive: boolean;
  /** True while a grant signature is in flight. */
  isApplying: boolean;
  /** True when the saved limit has not been pushed on-chain yet. */
  limitsDirty: boolean;
}

/**
 * Modal dialog for configuring application settings.
 * Private keys are never displayed — the session key is held server-side and
 * the on-chain grant is what actually bounds the agent.
 */
export const AiSettingsModal: React.FC<SettingsModalProps> = ({
  onClose, spendingLimit, onUpdateLimit, onApplyOnChain, isSessionActive, isApplying, limitsDirty
}) => {
  const [amount, setAmount] = useState(spendingLimit.amount);
  const [period, setPeriod] = useState(spendingLimit.period);
  const [defaultBuy, setDefaultBuy] = useState(spendingLimit.defaultBuyAmountUSD || 50);
  const hasChanges =
    amount !== spendingLimit.amount ||
    period !== spendingLimit.period ||
    defaultBuy !== (spendingLimit.defaultBuyAmountUSD || 50);

  // Limits only bind the agent once they are granted on-chain, so track whether
  // what's on screen matches what's installed.
  const limitChanged = amount !== spendingLimit.amount || period !== spendingLimit.period;
  const needsOnChainUpdate = limitChanged || limitsDirty;

  const handleSave = () => {
    onUpdateLimit({
      ...spendingLimit,
      amount: Number(amount),
      period,
      defaultBuyAmountUSD: Number(defaultBuy)
    });
    onClose();
  };

  const handleSignAllowance = async () => {
    await onApplyOnChain({
      ...spendingLimit,
      amount: Number(amount),
      period,
      defaultBuyAmountUSD: Number(defaultBuy),
      isEnabled: Number(amount) > 0,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/60 backdrop-blur-sm animate-in fade-in duration-200">
      <div className="glass-card rounded-2xl w-full max-w-md max-h-[90dvh] flex flex-col transform transition-all scale-100 text-[color:var(--color-depth)]">

        {/* Header */}
        <div className="flex justify-between items-center p-4 sm:p-6 border-b border-[color:var(--color-border)]">
          <h2 className="text-xl font-bold text-[color:var(--color-depth)] flex items-center gap-2">
            Settings
          </h2>
          <button onClick={onClose} className="text-[color:var(--color-depth)]/60 hover:text-[color:var(--color-depth)] transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 min-h-0 overflow-y-auto custom-scrollbar p-4 sm:p-6 space-y-8">

          {/* Spending Limits Section */}
          <div className="relative border border-[color:var(--color-border)] rounded-xl p-4 bg-[color:var(--color-depth)]/5">
            <div className="absolute -top-3 left-3 glass-card px-2 py-0.5 text-xs font-semibold text-[color:var(--color-accent)] uppercase tracking-wider flex items-center gap-1 rounded-md">
              <ShieldCheck size={12} /> Allowance Protocol
            </div>

            <div className="space-y-4 mt-2">
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
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

              {/* Usage against the installed limit */}
              {isSessionActive && spendingLimit.amount > 0 && (
                <div className="text-[11px] text-[color:var(--color-depth)]/60 flex justify-between">
                  <span>Spent this period</span>
                  <span className="font-medium text-[color:var(--color-depth)]/80">
                    ${spendingLimit.currentUsage.toFixed(2)} / ${spendingLimit.amount}
                  </span>
                </div>
              )}

              {/* On-Chain Signing */}
              <div className="pt-2 border-t border-[color:var(--color-border)]">
                <button
                  onClick={handleSignAllowance}
                  disabled={isApplying || !isSessionActive || !needsOnChainUpdate}
                  className={clsx(
                    "w-full py-2 border rounded-lg text-xs font-medium flex items-center justify-center gap-2 transition-all mt-2",
                    !isSessionActive || (!needsOnChainUpdate && !isApplying)
                      ? "bg-[color:var(--color-accent)]/15 border-[color:var(--color-accent)]/30 text-[color:var(--color-depth)] cursor-default"
                      : "bg-[color:var(--color-depth)]/5 border-[color:var(--color-border)] text-[color:var(--color-depth)]/80 hover:bg-[color:var(--color-depth)]/10"
                  )}
                >
                  {isApplying ? (
                    <><PenTool size={14} className="animate-pulse" /> Waiting for signature…</>
                  ) : !isSessionActive ? (
                    <>Activate AI mode to set limits</>
                  ) : needsOnChainUpdate ? (
                    <><PenTool size={14} /> Sign New Allowance On-Chain</>
                  ) : (
                    <><CheckCircle size={14} /> Limits active on-chain</>
                  )}
                </button>
                <p className="text-[10px] text-[color:var(--color-depth)]/60 mt-2 text-center leading-relaxed">
                  {needsOnChainUpdate && isSessionActive
                    ? "Saving stores your preference. The agent is only bound once the new allowance is signed on-chain."
                    : "The agent cannot spend beyond the allowance granted to its session key on-chain."}
                </p>
              </div>
            </div>
          </div>

        </div>

        {/* Footer */}
        <div className="p-4 sm:p-6 pt-0 shrink-0">
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
