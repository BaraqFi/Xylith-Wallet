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
            <div className="glass-card rounded-2xl w-full max-w-2xl overflow-hidden flex flex-col max-h-[80dvh] text-[color:var(--color-depth)]">

                <div className="p-4 sm:p-6 border-b border-slate-100 flex justify-between items-center">
                    <h2 className="text-xl font-bold text-slate-900 flex items-center gap-2">
                        <Command size={20} className="text-[color:var(--color-depth)]/60" /> Command Center
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-[color:var(--color-depth)]/5 rounded-full transition-colors">
                        <X size={20} className="text-[color:var(--color-depth)]/60" />
                    </button>
                </div>

                <div className="overflow-y-auto p-4 sm:p-6 space-y-8">

                    {/* Native Swaps */}
                    <section>
                        <h3 className="text-xs font-bold text-[color:var(--color-depth)] uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-[color:var(--color-border)] pb-2">
                            <ArrowLeftRight size={14} className="text-[color:var(--color-accent)]" /> Native Execution
                        </h3>
                        <p className="text-sm text-[color:var(--color-depth)]/70 mb-3 leading-relaxed">
                            Executes instantly on the source chain.
                        </p>
                        <div className="space-y-2">
                            <div className="bg-[color:var(--color-depth)]/5 px-3 py-2 rounded-lg border border-[color:var(--color-border)] flex items-center justify-between">
                                <code className="text-xs font-bold text-[color:var(--color-depth)]/80">&quot;Swap SOL to USDC&quot;</code>
                                <span className="text-[10px] text-[color:var(--color-depth)]/50 font-mono">SOLANA MAINNET</span>
                            </div>
                            <div className="bg-[color:var(--color-depth)]/5 px-3 py-2 rounded-lg border border-[color:var(--color-border)] flex items-center justify-between">
                                <code className="text-xs font-bold text-[color:var(--color-depth)]/80">&quot;Swap ETH to DAI&quot;</code>
                                <span className="text-[10px] text-[color:var(--color-depth)]/50 font-mono">ETHEREUM MAINNET</span>
                            </div>
                            <div className="bg-[color:var(--color-depth)]/5 px-3 py-2 rounded-lg border border-[color:var(--color-border)] flex items-center justify-between">
                                <code className="text-xs font-bold text-[color:var(--color-depth)]/80">&quot;Buy {`{Contract_Address}`}&quot;</code>
                                <span className="text-[10px] text-[color:var(--color-depth)]/50 font-mono">AUTO-DETECT</span>
                            </div>
                        </div>
                    </section>

                    {/* Cross Chain */}
                    <section>
                        <h3 className="text-xs font-bold text-[color:var(--color-depth)] uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-[color:var(--color-border)] pb-2">
                            <Globe size={14} className="text-[color:var(--color-accent)]" /> Cross-Chain & Bridging
                        </h3>
                        <p className="text-sm text-[color:var(--color-depth)]/70 mb-3 leading-relaxed">
                            To bridge assets, specify the destination chain or use a token native to another chain.
                        </p>
                        <div className="space-y-2">
                            <div className="bg-[color:var(--color-depth)]/5 px-3 py-2 rounded-lg border border-[color:var(--color-border)] flex items-center justify-between">
                                <code className="text-xs font-bold text-[color:var(--color-depth)]/80">&quot;Swap SOL to ETH on Ethereum&quot;</code>
                                <span className="text-[10px] text-[color:var(--color-accent)] font-bold font-mono">BRIDGE</span>
                            </div>
                            <div className="bg-[color:var(--color-depth)]/5 px-3 py-2 rounded-lg border border-[color:var(--color-border)] flex items-center justify-between">
                                <code className="text-xs font-bold text-[color:var(--color-depth)]/80">&quot;Swap ETH to {`{Solana_Address}`}&quot;</code>
                                <span className="text-[10px] text-[color:var(--color-accent)] font-bold font-mono">BRIDGE</span>
                            </div>
                        </div>
                    </section>

                    {/* Transaction History */}
                    <section>
                        <h3 className="text-xs font-bold text-[color:var(--color-depth)] uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-[color:var(--color-border)] pb-2">
                            <Clock size={14} className="text-[color:var(--color-accent)]" /> Transaction History
                        </h3>
                        <p className="text-sm text-[color:var(--color-depth)]/70 mb-3 leading-relaxed">
                            Fetch real on-chain history for your wallet or any public address.
                        </p>
                        <div className="space-y-2">
                            <div className="bg-[color:var(--color-depth)]/5 px-3 py-2 rounded-lg border border-[color:var(--color-border)] flex items-center justify-between">
                                <code className="text-xs font-bold text-[color:var(--color-depth)]/80">&quot;Show history&quot;</code>
                                <span className="text-[10px] text-[color:var(--color-depth)]/50 font-mono">DEFAULT: LAST 5 ALL CHAINS</span>
                            </div>
                            <div className="bg-[color:var(--color-depth)]/5 px-3 py-2 rounded-lg border border-[color:var(--color-border)] flex items-center justify-between">
                                <code className="text-xs font-bold text-[color:var(--color-depth)]/80">&quot;Show history for Solana&quot;</code>
                                <span className="text-[10px] text-[color:var(--color-accent)] font-bold font-mono">SOL ONLY</span>
                            </div>
                            <div className="bg-[color:var(--color-depth)]/5 px-3 py-2 rounded-lg border border-[color:var(--color-border)] flex items-center justify-between">
                                <code className="text-xs font-bold text-[color:var(--color-depth)]/80">&quot;History for {`{Address}`}&quot;</code>
                                <span className="text-[10px] text-[color:var(--color-accent)] font-bold font-mono">ANY WALLET</span>
                            </div>
                        </div>
                    </section>

                    {/* System Config */}
                    <section>
                        <h3 className="text-xs font-bold text-[color:var(--color-depth)] uppercase tracking-widest mb-3 flex items-center gap-2 border-b border-[color:var(--color-border)] pb-2">
                            <Cpu size={14} className="text-[color:var(--color-accent)]" /> Parameters
                        </h3>
                        <div className="grid grid-cols-2 gap-4">
                            <div className="text-sm text-[color:var(--color-depth)]/70">
                                <span className="font-bold text-[color:var(--color-depth)]">Default Buy Amount</span>
                                <p className="text-xs text-[color:var(--color-depth)]/60 mt-1">
                                    Set in Settings. Used when &quot;Buy {`{Token}`}&quot; is called without a specific dollar value.
                                </p>
                            </div>
                            <div className="text-sm text-[color:var(--color-depth)]/70">
                                <span className="font-bold text-[color:var(--color-depth)]">Allowance Keys</span>
                                <p className="text-xs text-[color:var(--color-depth)]/60 mt-1">
                                    Spending limits and periods must be signed on-chain to take effect for automated agents.
                                </p>
                            </div>
                        </div>
                    </section>

                </div>

                <div className="p-4 bg-[color:var(--color-depth)]/5 text-center text-xs text-[color:var(--color-depth)]/50 border-t border-[color:var(--color-border)] font-mono">
                    Xylith AI // Protocol Online
                </div>

            </div>
        </div>
    );
};
