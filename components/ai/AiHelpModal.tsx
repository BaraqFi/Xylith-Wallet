import React from 'react';
import { X, Command, Cpu, Globe, ArrowLeftRight, Clock } from 'lucide-react';

interface HelpModalProps {
    isOpen: boolean;
    onClose: () => void;
}

export const AiHelpModal: React.FC<HelpModalProps> = ({ isOpen, onClose }) => {
    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm animate-in fade-in duration-200">
            <div className="bg-white rounded-2xl w-full max-w-2xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]">

                <div className="p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Command size={20} className="text-slate-500" /> Command Center
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-slate-50 rounded-full transition-colors">
                        <X size={20} className="text-slate-500" />
                    </button>
                </div>

                <div className="overflow-y-auto p-6 space-y-8">

                    {/* Native Swaps */}
                    <section>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                            <ArrowLeftRight size={14} className="text-emerald-500" /> Native Execution
                        </h3>
                        <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                            Executes instantly on the source chain.
                        </p>
                        <div className="space-y-2">
                            <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 flex items-center justify-between">
                                <code className="text-xs font-bold text-slate-700">&quot;Swap SOL to USDC&quot;</code>
                                <span className="text-[10px] text-slate-400 font-mono">SOLANA MAINNET</span>
                            </div>
                            <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 flex items-center justify-between">
                                <code className="text-xs font-bold text-slate-700">&quot;Swap ETH to DAI&quot;</code>
                                <span className="text-[10px] text-slate-400 font-mono">ETHEREUM MAINNET</span>
                            </div>
                            <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 flex items-center justify-between">
                                <code className="text-xs font-bold text-slate-700">&quot;Buy {`{Contract_Address}`}&quot;</code>
                                <span className="text-[10px] text-slate-400 font-mono">AUTO-DETECT</span>
                            </div>
                        </div>
                    </section>

                    {/* Cross Chain */}
                    <section>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                            <Globe size={14} className="text-blue-500" /> Cross-Chain & Bridging
                        </h3>
                        <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                            To bridge assets, specify the destination chain or use a token native to another chain.
                        </p>
                        <div className="space-y-2">
                            <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 flex items-center justify-between">
                                <code className="text-xs font-bold text-slate-700">&quot;Swap SOL to ETH on Ethereum&quot;</code>
                                <span className="text-[10px] text-blue-500 font-bold font-mono">BRIDGE</span>
                            </div>
                            <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 flex items-center justify-between">
                                <code className="text-xs font-bold text-slate-700">&quot;Swap ETH to {`{Solana_Address}`}&quot;</code>
                                <span className="text-[10px] text-blue-500 font-bold font-mono">BRIDGE</span>
                            </div>
                        </div>
                    </section>

                    {/* Transaction History */}
                    <section>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                            <Clock size={14} className="text-orange-500" /> Transaction History
                        </h3>
                        <p className="text-sm text-slate-600 mb-3 leading-relaxed">
                            Fetch real on-chain history for your wallet or any public address.
                        </p>
                        <div className="space-y-2">
                            <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 flex items-center justify-between">
                                <code className="text-xs font-bold text-slate-700">&quot;Show history&quot;</code>
                                <span className="text-[10px] text-slate-400 font-mono">DEFAULT: LAST 5 ALL CHAINS</span>
                            </div>
                            <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 flex items-center justify-between">
                                <code className="text-xs font-bold text-slate-700">&quot;Show history for Solana&quot;</code>
                                <span className="text-[10px] text-orange-500 font-bold font-mono">SOL ONLY</span>
                            </div>
                            <div className="bg-slate-50 px-3 py-2 rounded-lg border border-slate-100 flex items-center justify-between">
                                <code className="text-xs font-bold text-slate-700">&quot;History for {`{Address}`}&quot;</code>
                                <span className="text-[10px] text-orange-500 font-bold font-mono">ANY WALLET</span>
                            </div>
                        </div>
                    </section>

                    {/* System Config */}
                    <section>
                        <h3 className="text-xs font-bold text-slate-900 uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-slate-100 pb-2">
                            <Cpu size={14} className="text-purple-500" /> Parameters
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-sm text-slate-600">
                                <span className="font-bold text-slate-800">Default Buy Amount</span>
                                <p className="text-xs text-slate-500 mt-1">
                                    Set in Settings. Used when &quot;Buy {`{Token}`}&quot; is called without a specific dollar value.
                                </p>
                            </div>
                            <div className="text-sm text-slate-600">
                                <span className="font-bold text-slate-800">Allowance Keys</span>
                                <p className="text-xs text-slate-500 mt-1">
                                    Spending limits and periods must be signed on-chain to take effect for automated agents.
                                </p>
                            </div>
                        </div>
                    </section>

                </div>

                <div className="p-4 bg-slate-50 text-center text-xs text-slate-400 border-t border-slate-100 font-mono">
                    Xylith AI // Protocol Online
                </div>

            </div>
        </div>
    );
};
