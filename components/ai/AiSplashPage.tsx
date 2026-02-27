import React from 'react';
import { Wallet, Shield, Zap } from 'lucide-react';

interface SplashPageProps {
  onGenerate: () => void;
  isGenerating: boolean;
}

export const AiSplashPage: React.FC<SplashPageProps> = ({ onGenerate, isGenerating }) => {
  return (
    <div className="h-[75dvh] min-h-[520px] sm:min-h-[600px] w-full bg-[color:var(--color-surface)] text-[color:var(--color-depth)] flex flex-col items-center justify-center p-4 sm:p-6 relative overflow-hidden">

      {/* Minimalist Background Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[520px] h-[520px] sm:w-[600px] sm:h-[600px] border border-[color:var(--color-border)] rounded-full animate-[spin_60s_linear_infinite]"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[360px] h-[360px] sm:w-[400px] sm:h-[400px] border border-[color:var(--color-border)] rounded-full animate-[spin_40s_linear_infinite_reverse]"></div>

      <div className="z-10 text-center max-w-md w-full animate-in fade-in slide-in-from-bottom-8 duration-700">

        <div className="mb-8 relative inline-block">
          <div className="w-24 h-24 rounded-full bg-[color:var(--color-depth)] flex items-center justify-center text-[color:var(--color-surface)] text-4xl font-bold shadow-2xl relative z-10">X</div>
          <div className="absolute inset-0 bg-[color:var(--color-depth)] blur-xl opacity-20 rounded-full"></div>
        </div>

        <h1 className="text-4xl sm:text-5xl font-bold text-[color:var(--color-depth)] mb-4 tracking-tighter">Xylith AI</h1>
        <p className="text-[color:var(--color-depth)]/60 mb-12 text-lg leading-relaxed">
          Spatial Intelligence for Blockchain.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-12">
          <div className="p-4 bg-[color:var(--color-depth)]/5 rounded-2xl border border-[color:var(--color-border)] text-left">
            <Shield className="w-6 h-6 text-[color:var(--color-accent)] mb-2" />
            <div className="font-bold text-[color:var(--color-depth)]">Private</div>
            <div className="text-xs text-[color:var(--color-depth)]/60">Keys stay on device</div>
          </div>
          <div className="p-4 bg-[color:var(--color-depth)]/5 rounded-2xl border border-[color:var(--color-border)] text-left">
            <Zap className="w-6 h-6 text-[color:var(--color-accent)] mb-2" />
            <div className="font-bold text-[color:var(--color-depth)]">Direct</div>
            <div className="text-xs text-[color:var(--color-depth)]/60">Mainnet execution</div>
          </div>
        </div>

        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full py-4 bg-[color:var(--color-accent)] hover:brightness-95 text-[color:var(--color-depth)] rounded-full font-bold text-base sm:text-lg transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {isGenerating ? "Initializing Core..." : "Initialize Wallet"}
        </button>

      </div>
    </div>
  );
};
