import React from 'react';
import { Transaction } from '@/lib/ai/types';
import { Shield, Zap, AlertTriangle, CheckCircle, Database } from 'lucide-react';
import clsx from 'clsx';

interface ActionPanelProps {
  activeTx: Transaction | null;
  onConfirm: (tx: Transaction) => void;
  onCancel: (txId: string) => void;
}

/**
 * The "Heads Up Display" for active operations.
 * Shows detailed diagnostics, gas estimates, and risk assessments.
 */
export const AiActionPanel: React.FC<ActionPanelProps> = ({ activeTx, onConfirm, onCancel }) => {

  if (!activeTx) {
    return (
      <div className="h-full flex flex-col items-center justify-center text-slate-600 opacity-50">
        <div className="w-24 h-24 rounded-full border border-dashed border-slate-700 flex items-center justify-center mb-4 animate-[spin_10s_linear_infinite]">
          <Database size={32} />
        </div>
        <p className="font-mono text-xs uppercase tracking-widest">System Idle</p>
        <p className="font-mono text-[10px]">Awaiting Command Input...</p>
      </div>
    );
  }

  const isPending = activeTx.status === 'NEEDS_APPROVAL' || activeTx.status === 'ESTIMATING_GAS';
  const riskColor = activeTx.riskLevel === 'HIGH' ? 'text-red-500' : activeTx.riskLevel === 'MEDIUM' ? 'text-yellow-500' : 'text-emerald-500';

  return (
    <div className="h-full flex flex-col font-mono relative overflow-hidden">
      {/* Background Grid Animation */}
      <div className="absolute inset-0 bg-[linear-gradient(rgba(16,185,129,0.03)_1px,transparent_1px),linear-gradient(90deg,rgba(16,185,129,0.03)_1px,transparent_1px)] bg-[size:20px_20px] pointer-events-none"></div>

      <div className="relative z-10 flex flex-col h-full p-6">

        {/* Header Ticket */}
        <div className="border-b border-dashed border-slate-700 pb-4 mb-6">
          <div className="flex justify-between items-center mb-2">
            <span className="text-xs text-slate-500 uppercase tracking-widest">Operation Ticket</span>
            <span className="text-xs text-cyan-500">#{activeTx.id.slice(0, 8)}</span>
          </div>
          <h2 className="text-xl text-white font-bold uppercase">{activeTx.type} PROTOCOL</h2>
          <div className="flex items-center gap-2 mt-1">
            <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded border border-slate-700">{activeTx.chain}</span>
            <span className="px-1.5 py-0.5 bg-slate-800 text-slate-300 text-[10px] rounded border border-slate-700">{activeTx.status}</span>
          </div>
        </div>

        {/* Diagnostics Grid */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 sm:gap-4 mb-6">
          <div className="bg-slate-900/50 border border-slate-800 p-3 rounded">
            <div className="text-[10px] text-slate-500 uppercase mb-1 flex items-center gap-1"><Zap size={10} /> Est. Gas</div>
            <div className="text-sm text-cyan-300">{activeTx.gasEstimate || "CALCULATING..."}</div>
          </div>
          <div className="bg-slate-900/50 border border-slate-800 p-3 rounded">
            <div className="text-[10px] text-slate-500 uppercase mb-1 flex items-center gap-1"><Shield size={10} /> Risk Level</div>
            <div className={clsx("text-sm font-bold", riskColor)}>{activeTx.riskLevel || "ANALYZING..."}</div>
          </div>
          <div className="col-span-2 bg-slate-900/50 border border-slate-800 p-3 rounded">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Target Address</div>
            <div className="text-xs text-slate-300 font-mono break-all">{activeTx.recipient || "UNKNOWN"}</div>
          </div>
          <div className="col-span-2 bg-slate-900/50 border border-slate-800 p-3 rounded">
            <div className="text-[10px] text-slate-500 uppercase mb-1">Payload</div>
            <div className="text-lg text-white font-bold">{activeTx.amount} {activeTx.token} <span className="text-xs font-normal text-slate-500">(${activeTx.amountUSD.toFixed(2)})</span></div>
          </div>
        </div>

        {/* Technical Summary */}
        <div className="flex-1 bg-black/40 rounded p-4 border border-slate-800 mb-6 overflow-y-auto">
          <p className="text-[10px] text-cyan-500/70 mb-2">{"/// KERNEL ANALYSIS OUTPUT"}</p>
          <p className="text-xs text-slate-400 leading-relaxed">
            {activeTx.technicalSummary || "Awaiting system analysis..."}
          </p>
          {activeTx.riskLevel === 'HIGH' && (
            <div className="mt-3 p-2 bg-red-500/10 border border-red-500/30 rounded flex items-start gap-2">
              <AlertTriangle size={14} className="text-red-500 mt-0.5" />
              <p className="text-[10px] text-red-300">WARNING: High value transfer detected. Verify recipient identity offline.</p>
            </div>
          )}
        </div>

        {/* Authorization Controls */}
        <div className="mt-auto">
          {isPending ? (
            <div className="flex gap-3">
              <button
                onClick={() => onCancel(activeTx.id)}
                className="flex-1 py-4 bg-slate-800 border border-slate-700 hover:bg-slate-700 text-slate-400 text-xs uppercase tracking-widest transition-all"
              >
                Abort
              </button>
              <button
                onClick={() => onConfirm(activeTx)}
                className="flex-[2] py-4 bg-emerald-600 hover:bg-emerald-500 text-white font-bold text-sm uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(16,185,129,0.3)] flex items-center justify-center gap-2 group"
              >
                <Zap size={16} className="group-hover:text-yellow-300 transition-colors" />
                Authorize
              </button>
            </div>
          ) : activeTx.status === 'COMPLETED' ? (
            <div className="w-full py-4 bg-emerald-900/20 border border-emerald-500/30 text-emerald-400 text-center uppercase text-sm tracking-widest flex items-center justify-center gap-2">
              <CheckCircle size={16} /> Execution Confirmed
            </div>
          ) : (
            <div className="w-full py-4 bg-slate-900/50 border border-slate-800 text-slate-600 text-center uppercase text-xs tracking-widest">
              Process Terminated
            </div>
          )}
        </div>

      </div>
    </div>
  );
};
