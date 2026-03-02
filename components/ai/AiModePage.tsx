"use client";

import React, { useState, useEffect, useRef } from 'react';
import { AICommand, LogEntry, WalletState, Transaction, SpendingLimit, Chain, BalanceMap } from "@/lib/ai/types";
import { generateWallet, getPriceEstimate, getNativeBalance, sendNativeToken, validateAddress, estimateGasCost, detectChainFromAddress, executeSwap, getTransactionHistory, shortenAddress } from "@/lib/ai/cryptoService";
import { parseUserCommand, summarizeHistory } from "@/lib/ai/geminiService";
import { AiChatMessage as ChatMessage } from "./AiChatMessage";
import { AiActionCard as ActionCard } from "./AiActionCard";
import { AiOrb as Orb } from "./AiOrb";
import { AiSettingsModal as SettingsModal } from "./AiSettingsModal";
import { AiHelpModal as HelpModal } from "./AiHelpModal";
import { AiSplashPage as SplashPage } from "./AiSplashPage";
import { ModeToggle } from "@/components/app/ModeToggle";
import { Settings, ArrowUp, Command, HelpCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

// --- Slash Commands Config ---
const COMMANDS = [
  { id: 'balance', label: '/balance', desc: 'Check funds', prompt: 'Check my balance' },
  { id: 'send', label: '/send', desc: 'Transfer assets', prompt: 'Send ' },
  { id: 'swap', label: '/swap', desc: 'Trade tokens', prompt: 'Swap ' },
  { id: 'history', label: '/history', desc: 'View transactions', prompt: 'Show history' },
  { id: 'clear', label: '/clear', desc: 'Clear chat', prompt: 'CLEAR_LOGS' },
];

export function AiModePage() {
  // --- State ---
  const [wallet, setWallet] = useState<WalletState | null>(null);
  const [, setBalances] = useState<BalanceMap>({ ETH: { native: 0 }, BASE: { native: 0 }, ARB: { native: 0 }, SOL: { native: 0 } });

  const [logs, setLogs] = useState<LogEntry[]>([
    {
      id: 'init-2',
      type: 'AGENT',
      content: "Type / for commands or ask to swap/buy tokens.",
      timestamp: Date.now()
    }
  ]);

  const [inputText, setInputText] = useState('');
  const [showCommands, setShowCommands] = useState(false);
  const [orbState, setOrbState] = useState<'IDLE' | 'THINKING' | 'PROCESSING' | 'ERROR'>('IDLE');
  const [activeTx, setActiveTx] = useState<Transaction | null>(null);
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [isSettingsOpen, setIsSettingsOpen] = useState(false);
  const [isHelpOpen, setIsHelpOpen] = useState(false);

  const [spendingLimit, setSpendingLimit] = useState<SpendingLimit>({
    amount: 1000,
    period: 'DAILY',
    lastReset: Date.now(),
    currentUsage: 0,
    isEnabled: true,
    defaultBuyAmountUSD: 50
  });

  const scrollRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  // --- Effects ---
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Handle Slash Command Detection
  useEffect(() => {
    if (inputText.startsWith('/')) {
      setShowCommands(true);
    } else {
      setShowCommands(false);
    }
  }, [inputText]);

  useEffect(() => {
    if (!wallet) return;
    const fetchBalances = async () => {
      const results = await Promise.allSettled([
        getNativeBalance(wallet.evmAddress, 'ETH'),
        getNativeBalance(wallet.evmAddress, 'BASE'),
        getNativeBalance(wallet.evmAddress, 'ARB'),
        getNativeBalance(wallet.solAddress, 'SOL')
      ]);
      setBalances(prev => {
        const getVal = (index: number, f: number) => results[index].status === 'fulfilled' ? (results[index] as PromiseFulfilledResult<number>).value : f;
        return { ETH: { native: getVal(0, prev.ETH.native) }, BASE: { native: getVal(1, prev.BASE.native) }, ARB: { native: getVal(2, prev.ARB.native) }, SOL: { native: getVal(3, prev.SOL.native) } };
      });
    };
    fetchBalances();
    const interval = setInterval(fetchBalances, 45000);
    return () => clearInterval(interval);
  }, [wallet]);

  // --- Logic ---

  const addLog = (type: LogEntry['type'], content: string, txId?: string) => {
    setLogs(prev => [...prev, { id: uuidv4(), timestamp: Date.now(), type, content, txId }]);
  };

  const handleCreateWallet = async () => {
    setOrbState('PROCESSING');
    await new Promise(r => setTimeout(r, 1500));
    const newWallet = generateWallet();
    setWallet(newWallet);
    setOrbState('IDLE');
  };

  const handleSelectCommand = (cmd: typeof COMMANDS[0]) => {
    if (cmd.id === 'clear') {
      setLogs([]);
      setInputText('');
    } else {
      setInputText(cmd.prompt);
      inputRef.current?.focus();
    }
    setShowCommands(false);
  };

  const handleCommand = async () => {
    if (!inputText.trim() || orbState === 'THINKING' || !wallet) return;

    if (inputText.trim() === 'CLEAR_LOGS') {
      setLogs([]);
      setInputText('');
      return;
    }

    const cmd = inputText;
    setInputText('');
    addLog('USER', cmd);
    setOrbState('THINKING');
    setShowCommands(false);

    try {
      const commandRes = await fetch("/api/ai/parse", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          userText: cmd,
          wallet: { evmAddress: wallet.evmAddress, solAddress: wallet.solAddress }
        })
      });

      if (!commandRes.ok) {
        throw new Error(`AI_PARSE_FAILED_${commandRes.status}`);
      }

      const command = (await commandRes.json()) as AICommand;

      await new Promise(r => setTimeout(r, 800));

      const isTxIntent = (i: AICommand['intent']): i is 'SEND' | 'SWAP' | 'BRIDGE' =>
        i === 'SEND' || i === 'SWAP' || i === 'BRIDGE';

      if (isTxIntent(command.intent)) {
        setOrbState('PROCESSING');

        let chain = (command.chain || 'ETH') as Chain;
        let amountUSD = command.amountUSD;

        // Auto-detect chain from Contract Address if provided (e.g. "Buy {CA}")
        if (command.contractAddress && !command.chain) {
          const detected = detectChainFromAddress(command.contractAddress);
          if (detected) chain = detected;
        }

        // Apply Default Buy Amount if "Buy" detected (Swap with no amount)
        if (command.intent === 'SWAP' && !amountUSD) {
          amountUSD = spendingLimit.defaultBuyAmountUSD;
          addLog('SYSTEM', `Applying default buy amount: $${amountUSD}`);
        }

        // Validation
        if (command.recipient && !validateAddress(chain, command.recipient)) {
          addLog('ERROR', `Invalid address for ${chain}.`);
          setOrbState('ERROR');
          setTimeout(() => setOrbState('IDLE'), 2000);
          return;
        }

        const price = getPriceEstimate(chain);
        const amountToken = amountUSD ? amountUSD / price : 0;

        const newTx: Transaction = {
          id: uuidv4(),
          type: command.intent,
          chain,
          targetChain: command.targetChain,
          amount: amountToken,
          amountUSD: amountUSD || 0,
          token: command.token || (chain === 'SOL' ? 'SOL' : 'ETH'),
          targetToken: command.targetToken,
          recipient: command.recipient,
          contractAddress: command.contractAddress,
          timestamp: Date.now(),
          status: 'ESTIMATING_GAS',
          riskLevel: command.riskAssessment,
          technicalSummary: command.technicalSummary
        };

        setActiveTx(newTx);
        addLog('AGENT', command.reply);

        // Gas / Simulation
        const targetAddr = command.recipient || command.contractAddress || "0x0000000"; // Fallback for est
        const gas = await estimateGasCost(chain, chain === 'SOL' ? wallet.solAddress : wallet.evmAddress, targetAddr, amountToken);
        setActiveTx(prev => prev ? ({ ...prev, gasEstimate: gas, status: 'NEEDS_APPROVAL' }) : null);

      } else {
        setOrbState('IDLE');
        if (command.intent === 'BALANCE') {
          const chain = (command.chain || 'ETH') as Chain;
          const addr = command.recipient || (chain === 'SOL' ? wallet.solAddress : wallet.evmAddress);
          try {
            const bal = await getNativeBalance(addr, chain);
            addLog('AGENT', `Current balance: ${bal.toFixed(4)} ${chain}`);
          } catch {
            addLog('ERROR', "Could not fetch balance.");
          }
        } else if (command.intent === 'HISTORY') {
          addLog('AGENT', command.reply || "Fetching transaction history...");

          const limit = command.limit || 5;
          const results: string[] = [];

          // Case 1: Specific Chain requested
          if (command.chain) {
            const targetAddr = command.recipient || (command.chain === 'SOL' ? wallet.solAddress : wallet.evmAddress);
            const txs = await getTransactionHistory(command.chain, targetAddr, limit);
            if (txs.length === 0) {
              results.push(`${command.chain}: No recent transactions found (or API limit reached).`);
            } else {
              results.push(`${command.chain} History (${targetAddr.slice(0, 6)}...):`);
              txs.forEach(tx => results.push(`• ${shortenAddress(tx.hash)} | ${tx.success ? 'OK' : 'FAIL'}`));
            }
          }
          // Case 2: No Chain specified -> Fetch BOTH (if recipient is generic/null)
          else {
            // If recipient provided, we must detect chain first
            if (command.recipient) {
              const detected = detectChainFromAddress(command.recipient);
              if (detected) {
                const txs = await getTransactionHistory(detected, command.recipient, limit);
                results.push(`${detected} History for ${shortenAddress(command.recipient)}:`);
                txs.forEach(tx => results.push(`• ${shortenAddress(tx.hash)}`));
              } else {
                results.push("Could not identify chain for provided address.");
              }
            } else {
              // Fetch Both Defaults
              const [solTxs, ethTxs] = await Promise.all([
                getTransactionHistory('SOL', wallet.solAddress, limit),
                getTransactionHistory('ETH', wallet.evmAddress, limit)
              ]);

              results.push(`SOL History (${limit} latest):`);
              if (solTxs.length) solTxs.forEach(tx => results.push(`• ${shortenAddress(tx.hash)}`));
              else results.push("No transactions.");

              results.push(`ETH History (${limit} latest):`);
              if (ethTxs.length) ethTxs.forEach(tx => results.push(`• ${shortenAddress(tx.hash)}`));
              else results.push("No transactions / API Limit.");
            }
          }

          addLog('AGENT', results.join('\n'));

        } else if (command.intent === 'HISTORY_SUMMARY') {
          const summaryRes = await fetch("/api/ai/summarize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ history: transactions })
          });

          if (!summaryRes.ok) {
            throw new Error(`AI_SUMMARY_FAILED_${summaryRes.status}`);
          }

          const data = (await summaryRes.json()) as { summary?: string };
          addLog('AGENT', data.summary || "SUMMARY_UNAVAILABLE");
        } else {
          addLog('AGENT', command.reply);
        }
      }

    } catch {
      addLog('ERROR', "I couldn't process that.");
      setOrbState('ERROR');
      setTimeout(() => setOrbState('IDLE'), 2000);
    }
  };

  const handleExecuteTx = async (tx: Transaction) => {
    if (!wallet) return;

    // Don't close card immediately, allow "BROADCASTING" state to show
    setActiveTx(prev => prev ? ({ ...prev, status: 'BROADCASTING' }) : null);
    setOrbState('PROCESSING');

    try {
      let result;

      if (tx.type === 'SEND') {
        if (!tx.recipient) throw new Error("No recipient");
        result = await sendNativeToken(wallet, tx.chain, tx.recipient, tx.amount);
      } else if (tx.type === 'SWAP' || tx.type === 'BRIDGE') {
        // Use the simulated swap/bridge executor
        // If ContractAddress is missing (e.g. bridge), we use a placeholder logic inside executeSwap
        result = await executeSwap(wallet, tx.chain, tx.contractAddress || "0xROUTER", tx.amount);
      } else {
        throw new Error("Unknown transaction type");
      }

      const completedTx = { ...tx, status: 'COMPLETED' as const, hash: result.hash };

      setActiveTx(completedTx); // Updates card to Success state
      setTransactions(prev => [...prev, completedTx]);
      setSpendingLimit(prev => ({ ...prev, currentUsage: prev.currentUsage + tx.amountUSD }));

      addLog('SUCCESS', `Confirmed. Hash: ${result.hash.slice(0, 8)}...`);
      setOrbState('IDLE');
    } catch (e: unknown) {
      const message = e instanceof Error ? e.message : "UNKNOWN_ERROR";
      addLog('ERROR', `Transaction failed: ${message}`);
      setOrbState('ERROR');
      setActiveTx(prev => prev ? ({ ...prev, status: 'FAILED', error: message }) : null);
      // Timeout managed by ActionCard useEffect now
    }
  };

  const handleCancelTx = (id: string) => {
    setActiveTx(null);
    setOrbState('IDLE');
    if (!transactions.find(t => t.id === id)) {
      addLog('SYSTEM', "Cancelled by user");
    }
  };

  // --- Render ---

  if (!wallet) return (
    <div className="h-full w-full bg-transparent text-[color:var(--color-depth)] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-1 pb-0 sm:px-6 sm:pt-2 z-30 shrink-0">
        <div />
        <ModeToggle />
      </div>
      <div className="flex-1 min-h-0">
        <SplashPage onGenerate={handleCreateWallet} isGenerating={orbState === 'PROCESSING'} />
      </div>
    </div>
  );

  const filteredCommands = COMMANDS.filter(c => c.label.toLowerCase().includes(inputText.toLowerCase()));

  return (
    <div className="h-full w-full bg-transparent text-[color:var(--color-depth)] relative overflow-hidden">

      {/* Modals */}
      {isSettingsOpen && (
        <SettingsModal
          onClose={() => setIsSettingsOpen(false)}
          spendingLimit={spendingLimit}
          onUpdateLimit={setSpendingLimit}
          wallet={wallet}
        />
      )}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* ── ORB — z-0 background ── */}
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-80">
        {/* 
          PWA standalone on mobile was leaving too much vertical dead space
          around the orb, which visually pushed the chat area down.
          The sizing below makes the orb larger and slightly lower on small
          viewports, and caps it by viewport height as well as width so it
          stays balanced across PWA / mobile web / desktop.
        */}
        <div className="relative w-[min(110vw,520px)] h-[min(110vw,520px)] max-h-[70vh] sm:w-[min(70vw,680px)] sm:h-[min(70vw,680px)] md:w-[800px] md:h-[800px] -translate-y-[2%] sm:-translate-y-[4%] md:-translate-y-[8%]">
          <Orb state={orbState} />
        </div>
      </div>

      {/* ── TOP BAR — absolute top ── */}
      <div className="absolute top-0 left-0 right-0 z-20 flex items-center justify-between px-4 pt-1 pb-2 sm:px-6 sm:pt-2">
        <div className="flex items-center gap-3">
          <button
            onClick={() => setIsHelpOpen(true)}
            className="w-10 h-10 rounded-full bg-[color:var(--color-depth)]/5 hover:bg-[color:var(--color-depth)]/10 flex items-center justify-center transition-colors border border-[color:var(--color-border)] shadow-sm"
          >
            <HelpCircle size={22} className="text-[color:var(--color-depth)]/80" strokeWidth={2.5} />
          </button>
          <button
            onClick={() => setIsSettingsOpen(true)}
            className="w-10 h-10 rounded-full bg-[color:var(--color-depth)]/5 hover:bg-[color:var(--color-depth)]/10 flex items-center justify-center transition-colors border border-[color:var(--color-border)] shadow-sm"
          >
            <Settings size={22} className="text-[color:var(--color-depth)]/80" strokeWidth={2.5} />
          </button>
        </div>
        <ModeToggle />
      </div>

      {/* Action Card overlay */}
      {activeTx && (
        <ActionCard tx={activeTx} onConfirm={handleExecuteTx} onCancel={handleCancelTx} />
      )}

      {/* ── CHAT STREAM — fills between top bar and input dock ── */}
      <div className="absolute top-14 bottom-14 left-0 right-0 z-10 px-4 sm:px-6 pointer-events-none">
        <div className="h-full max-w-2xl mx-auto flex flex-col justify-end">
          <div className="overflow-y-auto fade-mask pointer-events-auto scroll-smooth no-scrollbar pb-2" ref={scrollRef}>
            {logs.map(log => <ChatMessage key={log.id} entry={log} />)}
            {orbState === 'THINKING' && (
              <div className="text-center text-xs text-[color:var(--color-depth)]/50 animate-pulse tracking-widest uppercase mb-2">
                Processing
              </div>
            )}
          </div>
        </div>
      </div>

      {/* ── INPUT DOCK — absolute bottom ── */}
      <div className="absolute bottom-0 left-0 right-0 z-20 px-4 sm:px-6 pb-[max(0.5rem,env(safe-area-inset-bottom))] pt-1">
        <div className="max-w-xl mx-auto relative">

          {/* Slash Commands Popup */}
          {showCommands && filteredCommands.length > 0 && (
            <div className="absolute bottom-full mb-3 left-0 w-full glass-card rounded-2xl overflow-hidden p-1 shadow-2xl animate-in fade-in zoom-in-95 slide-in-from-bottom-2">
              {filteredCommands.map(cmd => (
                <button
                  key={cmd.id}
                  onClick={() => handleSelectCommand(cmd)}
                  className="w-full text-left px-4 py-3 hover:bg-[color:var(--color-depth)]/5 rounded-xl transition-colors flex items-center gap-3 group"
                >
                  <div className="w-8 h-8 rounded-full bg-[color:var(--color-depth)] text-[color:var(--color-surface)] flex items-center justify-center font-mono text-xs shadow-sm group-hover:scale-110 transition-transform">/</div>
                  <div>
                    <div className="text-sm font-bold text-[color:var(--color-depth)]">{cmd.label}</div>
                    <div className="text-xs text-[color:var(--color-depth)]/60">{cmd.desc}</div>
                  </div>
                </button>
              ))}
            </div>
          )}

          <div className="glass-card pl-4 sm:pl-6 pr-2 py-2 rounded-full flex items-center w-full transition-shadow hover:shadow-lg focus-within:shadow-xl">
            <input
              ref={inputRef}
              type="text"
              value={inputText}
              onChange={(e) => setInputText(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === 'Enter') {
                  if (showCommands && filteredCommands.length > 0 && inputText.startsWith('/')) {
                    handleSelectCommand(filteredCommands[0]);
                  } else {
                    handleCommand();
                  }
                } else if (e.key === 'Escape') {
                  setShowCommands(false);
                }
              }}
              placeholder="Type / for commands..."
              className="flex-1 bg-transparent border-none outline-none text-[color:var(--color-depth)] placeholder:text-[color:var(--color-depth)]/40 font-medium text-sm sm:text-base"
              disabled={orbState !== 'IDLE'}
            />
            <button
              onClick={handleCommand}
              disabled={!inputText.trim() || orbState !== 'IDLE'}
              className="w-10 h-10 rounded-full bg-[color:var(--color-accent)] text-[color:var(--color-depth)] flex items-center justify-center hover:scale-105 active:scale-95 transition-transform disabled:bg-[color:var(--color-depth)]/20 disabled:text-[color:var(--color-depth)]/50 disabled:scale-100"
            >
              {inputText.startsWith('/') ? <Command size={18} /> : <ArrowUp size={20} />}
            </button>
          </div>
        </div>
      </div>

    </div>
  );
}
