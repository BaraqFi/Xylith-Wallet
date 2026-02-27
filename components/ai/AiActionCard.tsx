import React, { useEffect } from 'react';
import { Transaction } from '@/lib/ai/types';
import { Shield, Zap, Check, X, ArrowRight, Loader2, AlertTriangle, ArrowLeftRight, Globe } from 'lucide-react';
import clsx from 'clsx';

interface ActionCardProps {
  tx: Transaction;
  onConfirm: (tx: Transaction) => void;
  onCancel: (txId: string) => void;
}

/**
 * A floating glass card that appears when the AI proposes a transaction.
 */
export const AiActionCard: React.FC<ActionCardProps> = ({ tx, onConfirm, onCancel }) => {
  const isProcessing = tx.status === 'BROADCASTING' || tx.status === 'ESTIMATING_GAS';
  const isHighRisk = tx.riskLevel === 'HIGH';
  const isDone = tx.status === 'COMPLETED' || tx.status === 'FAILED';

  // Auto-close after completion
  useEffect(() => {
    if (isDone) {
      const timer = setTimeout(() => {
        onCancel(tx.id);
      }, 4000);
      return () => clearTimeout(timer);
    }
  }, [isDone, tx.id, onCancel]);

  const getIcon = () => {
    if (tx.type === 'SWAP') return <ArrowLeftRight size={18} />;
    if (tx.type === 'BRIDGE') return <Globe size={18} />;
    return <Zap size={18} />;
  };

  return (
    <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-80 md:w-96 glass-card rounded-3xl p-6 z-20 animate-in zoom-in-95 duration-300">

      {/* Header */}
      <div className="flex justify-between items-start mb-6">
        <div>
          <div className="text-[10px] uppercase tracking-widest text-slate-400 mb-1">Authorization Request</div>
          <div className="font-bold text-slate-900 text-lg flex items-center gap-2">
            {tx.type} <span className="text-slate-300">/</span> {tx.chain}
            {tx.targetChain && <><span className="text-slate-300">→</span> {tx.targetChain}</>}
          </div>
        </div>
        {isHighRisk && !isDone && (
          <div className="bg-red-50 text-red-500 p-2 rounded-full animate-pulse" title="High Risk">
            <Shield size={16} />
          </div>
        )}
      </div>

      {/* Main Display */}
      {tx.status === 'FAILED' ? (
        <div className="bg-red-50 rounded-2xl p-6 mb-6 text-center border border-red-100">
          <AlertTriangle size={32} className="text-red-500 mx-auto mb-2" />
          <div className="text-red-800 font-bold">Transaction Failed</div>
          <div className="text-xs text-red-600 mt-1">{tx.error || "Unknown Error"}</div>
        </div>
      ) : tx.status === 'COMPLETED' ? (
        <div className="bg-emerald-50 rounded-2xl p-6 mb-6 text-center border border-emerald-100">
          <Check size={32} className="text-emerald-500 mx-auto mb-2" />
          <div className="text-emerald-800 font-bold">Execution Confirmed</div>
          <div className="text-xs text-emerald-600 mt-1">TxHash: {tx.hash?.slice(0, 8)}...</div>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between bg-slate-50 rounded-2xl p-4 mb-6 border border-slate-100">
            <div>
              <span className="text-2xl font-bold text-slate-900">{tx.amount}</span>
              <span className="text-sm font-medium text-slate-400 ml-1">{tx.token}</span>
            </div>
            <ArrowRight size={20} className="text-slate-300" />
            <div className="text-right">
              <div className="text-xs text-slate-400 font-mono mb-1">
                {tx.type === 'SWAP' ? 'RECEIVE' : 'RECIPIENT'}
              </div>
              <div className="text-xs font-bold text-slate-700 font-mono">
                {tx.targetToken || tx.recipient?.slice(0, 4) + '...' + tx.recipient?.slice(-4)}
              </div>
            </div>
          </div>

          {/* Stats */}
          <div className="grid grid-cols-2 gap-4 mb-8">
            <div>
              <div className="text-[10px] text-slate-400 uppercase">Estimated Gas</div>
              <div className="text-sm font-medium text-slate-700">{tx.gasEstimate || "Calculating..."}</div>
            </div>
            <div>
              <div className="text-[10px] text-slate-400 uppercase">USD Value</div>
              <div className="text-sm font-medium text-slate-700">${tx.amountUSD.toFixed(2)}</div>
            </div>
          </div>
        </>
      )}

      {/* Actions */}
      {!isDone && (
        <div className="flex gap-3">
          <button
            onClick={() => onCancel(tx.id)}
            // We allow cancel even during processing to force-close UI (logic in parent should handle state)
            className="flex-1 py-3 bg-slate-100 hover:bg-slate-200 text-slate-600 rounded-xl font-medium transition-colors flex items-center justify-center"
          >
            <X size={18} />
          </button>
          <button
            onClick={() => onConfirm(tx)}
            disabled={isProcessing}
            className={clsx(
              "flex-[3] py-3 rounded-xl font-bold text-white shadow-lg transition-all flex items-center justify-center gap-2",
              isHighRisk ? "bg-slate-900 hover:bg-slate-800" : "bg-black hover:bg-slate-800"
            )}
          >
            {isProcessing ? <Loader2 size={18} className="animate-spin" /> : getIcon()}
            {isProcessing ? "Processing..." : tx.type === 'SWAP' ? "Swap" : tx.type === 'BRIDGE' ? "Bridge" : "Send"}
          </button>
        </div>
      )}
    </div>
  );
};