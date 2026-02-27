import React from 'react';
import { Wallet, Shield, Zap } from 'lucide-react';

interface SplashPageProps {
  onGenerate: () => void;
  isGenerating: boolean;
}

export const AiSplashPage: React.FC<SplashPageProps> = ({ onGenerate, isGenerating }) => {
  return (
    <div className="min-h-screen bg-white flex flex-col items-center justify-center p-6 relative overflow-hidden">

      {/* Minimalist Background Elements */}
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[600px] h-[600px] border border-slate-100 rounded-full animate-[spin_60s_linear_infinite]"></div>
      <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[400px] h-[400px] border border-slate-100 rounded-full animate-[spin_40s_linear_infinite_reverse]"></div>

      <div className="z-10 text-center max-w-md w-full animate-in fade-in slide-in-from-bottom-8 duration-700">

        <div className="mb-8 relative inline-block">
          <div className="w-24 h-24 rounded-full bg-slate-900 flex items-center justify-center text-white text-4xl font-bold shadow-2xl relative z-10">X</div>
          <div className="absolute inset-0 bg-slate-900 blur-xl opacity-20 rounded-full"></div>
        </div>

        <h1 className="text-5xl font-bold text-slate-900 mb-4 tracking-tighter">Xylith AI</h1>
        <p className="text-slate-500 mb-12 text-lg leading-relaxed">
          Spatial Intelligence for Blockchain.
        </p>

        <div className="grid grid-cols-2 gap-4 mb-12">
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
            <Shield className="w-6 h-6 text-slate-900 mb-2" />
            <div className="font-bold text-slate-900">Private</div>
            <div className="text-xs text-slate-500">Keys stay on device</div>
          </div>
          <div className="p-4 bg-slate-50 rounded-2xl border border-slate-100 text-left">
            <Zap className="w-6 h-6 text-slate-900 mb-2" />
            <div className="font-bold text-slate-900">Direct</div>
            <div className="text-xs text-slate-500">Mainnet execution</div>
          </div>
        </div>

        <button
          onClick={onGenerate}
          disabled={isGenerating}
          className="w-full py-4 bg-slate-900 hover:bg-black text-white rounded-full font-bold text-lg transition-all shadow-xl hover:shadow-2xl hover:-translate-y-1 disabled:opacity-70 flex items-center justify-center gap-2"
        >
          {isGenerating ? "Initializing Core..." : "Initialize Wallet"}
        </button>

      </div>
    </div>
  );
};
