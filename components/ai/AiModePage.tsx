"use client";

import React, { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { usePrivy } from '@privy-io/react-auth';
import { useWallets, useSign7702Authorization } from '@privy-io/react-auth';
// Solana wallets are NOT in the main useWallets() (Ethereum-only); they come
// from the dedicated solana entrypoint.
import { useWallets as useSolanaWallets } from '@privy-io/react-auth/solana';
import { pickSolanaWallet, signSolanaTransactionBytes } from '@/lib/solana/privyWallet';
import { Buffer } from 'buffer';
import { AICommand, LogEntry, Transaction, SpendingLimit, Chain } from "@/lib/ai/types";
import { getNativeBalance, validateAddress, estimateGasCost, detectChainFromAddress, getTransactionHistory, shortenAddress } from "@/lib/ai/cryptoService";
import { getLiveUsdPrice } from "@/lib/ai/prices";
import { sanitizeError } from "@/lib/ai/errorSanitizer";
import {
  toAiHoldings,
  findHolding,
  holdingsVocabulary,
  formatHoldingLine,
  formatTokenAmount,
} from "@/lib/ai/tokenHoldings";
import { useTokenBalances } from "@/hooks/useTokenBalances";
import { createWalletClient, custom, parseUnits, encodeFunctionData, parseAbi } from "viem";
import { SystemProgram, PublicKey, Transaction as SolTransaction } from "@solana/web3.js";
import { solanaClient } from "@/lib/solana/client";
import { AiChatMessage as ChatMessage } from "./AiChatMessage";
import { AiActionCard as ActionCard } from "./AiActionCard";
import { AiOrb as Orb } from "./AiOrb";
import { AiSettingsModal as SettingsModal } from "./AiSettingsModal";
import { AiHelpModal as HelpModal } from "./AiHelpModal";
import { AiSplashPage as SplashPage } from "./AiSplashPage";
import { ModeToggle } from "@/components/app/ModeToggle";
import { Settings, ArrowUp, Command, HelpCircle } from 'lucide-react';
import { v4 as uuidv4 } from 'uuid';

/**
 * Convert a token amount to base units without float truncation.
 * `Math.floor(amount * 1e18)` loses precision on computed amounts (a half
 * balance, a USD conversion), so the value is fixed to the token's decimals
 * first and parsed exactly.
 */
const toBaseUnits = (amount: number, decimals: number): bigint =>
  parseUnits(amount.toFixed(decimals), decimals);

/** Client-only preferences (the spend limit itself lives server-side). */
const PREFS_STORAGE_KEY = 'xylith_ai_prefs';

// --- Slash Commands Config ---
const COMMANDS = [
  { id: 'balance', label: '/balance', desc: 'Check funds', prompt: 'Check my balance' },
  { id: 'send', label: '/send', desc: 'Transfer assets', prompt: 'Send ' },
  { id: 'swap', label: '/swap', desc: 'Trade tokens', prompt: 'Swap ' },
  { id: 'history', label: '/history', desc: 'View transactions', prompt: 'Show history' },
  { id: 'tokens', label: '/tokens', desc: 'Tokens you hold', prompt: 'SHOW_TOKENS' },
  { id: 'wallet', label: '/wallet', desc: 'Show wallet addresses', prompt: 'SHOW_WALLET' },
  { id: 'clear', label: '/clear', desc: 'Clear chat', prompt: 'CLEAR_LOGS' },
];

export function AiModePage() {
  const { user, getAccessToken } = usePrivy();
  const { wallets } = useWallets();
  const { wallets: solanaWallets } = useSolanaWallets();
  const { signAuthorization: signPrivyAuthorization } = useSign7702Authorization();

  // --- Derive wallet addresses from Privy user (no ephemeral wallets) ---
  const evmAccount = user?.linkedAccounts?.find(
    (a) => a.type === 'wallet' && 'chainType' in a && a.chainType === 'ethereum' && 'walletClientType' in a && a.walletClientType === 'privy'
  );
  const evmAddress = evmAccount && 'address' in evmAccount ? (evmAccount.address as string) : undefined;

  const solAccount = user?.linkedAccounts?.find(
    (a) => a.type === 'wallet' && 'chainType' in a && a.chainType === 'solana' && 'walletClientType' in a && a.walletClientType === 'privy'
  );
  const solAddress = solAccount && 'address' in solAccount ? (solAccount.address as string) : undefined;

  // Token holdings on the chains AI mode supports. These are the ONLY tokens the
  // agent can name or act on — reusing the manual wallet's balance hook (and its
  // caching) rather than a second fetching path.
  const { balances: evmTokenBalances, isLoading: isLoadingEvmTokens } = useTokenBalances('EVM', 'ethereum');
  const { balances: solTokenBalances, isLoading: isLoadingSolTokens } = useTokenBalances('Solana', 'ethereum');
  const isLoadingHoldings = isLoadingEvmTokens || isLoadingSolTokens;
  const holdings = useMemo(
    () => [
      ...toAiHoldings(evmTokenBalances, 'ETH'),
      ...toAiHoldings(solTokenBalances, 'SOL'),
    ],
    [evmTokenBalances, solTokenBalances],
  );

  // --- State ---
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

  // AI session status: determines whether we show the splash or go straight to chat.
  const [aiSessionStatus, setAiSessionStatus] = useState<'unknown' | 'none' | 'active' | 'expired'>('unknown');
  // The active session key, needed to re-grant permissions when limits change.
  const [sessionSignerAddress, setSessionSignerAddress] = useState<string | null>(null);
  const [isApplyingLimits, setIsApplyingLimits] = useState(false);
  /** True when the saved limit differs from what is actually installed on-chain. */
  const [limitsDirty, setLimitsDirty] = useState(false);

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

  // --- Helpers ---
  const addLog = useCallback((type: LogEntry['type'], content: string, txId?: string) => {
    setLogs(prev => [...prev, { id: uuidv4(), timestamp: Date.now(), type, content, txId }]);
  }, []);

  /** Get Privy auth token for backend API calls */
  const getAuthHeaders = useCallback(async () => {
    const token = await getAccessToken();
    return {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {}),
    };
  }, [getAccessToken]);

  // --- Effects ---

  // Check AI session status when component mounts or user changes
  useEffect(() => {
    if (!user) return;

    let cancelled = false;
    let timer: ReturnType<typeof setTimeout> | undefined;

    const checkSession = async (attempt = 0) => {
      try {
        // Without a token the request is a guaranteed 401, which would flip an
        // active session to "none" and bounce the user back to the splash.
        // Privy can hand one over a beat late, so wait for it instead.
        const token = await getAccessToken();
        if (cancelled) return;
        if (!token) {
          if (attempt < 5) {
            timer = setTimeout(() => checkSession(attempt + 1), 1000);
          } else {
            setAiSessionStatus("none");
          }
          return;
        }

        const res = await fetch("/api/ai/session", {
          method: "GET",
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${token}`,
          },
        });
        if (cancelled) return;
        if (!res.ok) {
          setAiSessionStatus("none");
          return;
        }
        const data = await res.json();
        if (cancelled) return;
        if (data.status === "active") {
          setAiSessionStatus("active");
          setSessionSignerAddress(data.session?.signerAddress ?? null);
          // The server's stored policy is the truth for spend accounting, so
          // settings reflect what is actually installed rather than defaults.
          if (typeof data.session?.spendLimitUsd === 'number') {
            setSpendingLimit((prev) => ({
              ...prev,
              amount: data.session.spendLimitUsd > 0 ? data.session.spendLimitUsd : prev.amount,
              isEnabled: data.session.spendLimitUsd > 0,
              period: data.session.spendPeriod === 'WEEKLY' ? 'WEEKLY' : 'DAILY',
              currentUsage: data.session.spentUsd ?? 0,
            }));
          }
          setLimitsDirty(false);
        } else if (data.status === "expired") {
          setAiSessionStatus("expired");
        } else {
          setAiSessionStatus("none");
        }
      } catch {
        if (!cancelled) setAiSessionStatus("none");
      }
    };
    checkSession();

    return () => {
      cancelled = true;
      if (timer) clearTimeout(timer);
    };
  }, [user, getAccessToken]);

  // Auto-scroll chat
  useEffect(() => {
    if (scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [logs]);

  // Slash command detection
  useEffect(() => {
    if (inputText.startsWith('/')) {
      setShowCommands(true);
    } else {
      setShowCommands(false);
    }
  }, [inputText]);

  // Restore client-side preferences (the spend limit is hydrated from the
  // server session instead, since that is what the accounting uses).
  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(PREFS_STORAGE_KEY);
      if (!raw) return;
      const saved = JSON.parse(raw) as { defaultBuyAmountUSD?: number };
      if (typeof saved.defaultBuyAmountUSD === 'number' && saved.defaultBuyAmountUSD > 0) {
        setSpendingLimit((prev) => ({ ...prev, defaultBuyAmountUSD: saved.defaultBuyAmountUSD! }));
      }
    } catch {
      // ignore unreadable/corrupt preferences
    }
  }, []);

  // NOTE: a 45s native-balance poll used to live here, writing into state that
  // nothing read. It also consumed the entire client-side ETH RPC budget, so any
  // command needing a balance or gas estimate failed with "Too many requests".
  // Balances now come from the holdings hooks above.

  // --- Logic ---

  /**
   * Build a smart-wallet client bound to the user's Privy wallet.
   * Shared by activation and by re-granting permissions from settings.
   */
  const buildSmartWalletClient = useCallback(async () => {
    const privyWallet = wallets.find((w) => w.walletClientType === "privy") || wallets[0];
    if (!privyWallet) throw new Error("Wallet not connected.");

    // Dynamic imports to avoid Turbopack HMR bug with ox/WebAuthnP256
    const { createSmartWalletClient } = await import("@account-kit/wallet-client");
    const { WalletClientSigner } = await import("@aa-sdk/core");
    const { alchemy, mainnet: alchemyMainnet } = await import("@account-kit/infra");

    const provider = await privyWallet.getEthereumProvider();
    const viemWalletClient = createWalletClient({
      chain: (await import("viem/chains")).mainnet,
      transport: custom(provider),
    });
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- viem/aa-sdk client generic interop
    const baseSigner = new WalletClientSigner(viemWalletClient as any, "wallet");

    // viem cannot sign EIP-7702 authorizations with a JSON-RPC account
    // (AccountTypeNotSupportedError) — the embedded key lives in Privy's
    // enclave, so authorization signing must go through Privy's dedicated
    // hook. Messages and typed data still sign through the wallet client.
    const signer = {
      signerType: baseSigner.signerType,
      inner: baseSigner.inner,
      getAddress: () => baseSigner.getAddress(),
      signMessage: (message: Parameters<typeof baseSigner.signMessage>[0]) =>
        baseSigner.signMessage(message),
      signTypedData: (params: Parameters<typeof baseSigner.signTypedData>[0]) =>
        baseSigner.signTypedData(params),
      signAuthorization: async (unsignedAuth: {
        address?: `0x${string}`;
        contractAddress?: `0x${string}`;
        chainId: number;
        nonce: number;
      }) => {
        const contractAddress = (unsignedAuth.address ??
          unsignedAuth.contractAddress) as `0x${string}`;
        const signed = await signPrivyAuthorization({
          contractAddress,
          chainId: unsignedAuth.chainId,
          nonce: unsignedAuth.nonce,
        });
        return {
          ...unsignedAuth,
          address: contractAddress,
          r: signed.r,
          s: signed.s,
          v: (signed as { v?: bigint }).v,
          yParity: (signed as { yParity?: number }).yParity,
        };
      },
      // eslint-disable-next-line @typescript-eslint/no-explicit-any -- structural SmartAccountSigner
    } as any;

    return createSmartWalletClient({
      // IMPORTANT: No Alchemy API key on the client. We use a server-side JSON-RPC proxy.
      transport: alchemy({ rpcUrl: "/api/alchemy/wallet?chain=ethereum" }),
      chain: alchemyMainnet,
      signer,
    });
  }, [wallets, signPrivyAuthorization]);

  /**
   * Grant session-key permissions for a spend policy and persist them server-side.
   * This is what actually puts limits on-chain — used both when activating and
   * when the user changes limits in settings.
   */
  const grantAndPersistPermissions = useCallback(async (
    // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK client type
    client: any,
    sessionKeyAddress: string,
    limit: SpendingLimit,
  ) => {
    if (!evmAddress) throw new Error("No wallet address.");

    // Derive the on-chain native-transfer allowance from the user's configured
    // USD limit and the live ETH price. This is the hard cap the session key
    // cannot exceed on-chain. Falls back to a conservative 0.1 ETH if unset.
    const CONSERVATIVE_ALLOWANCE_WEI = BigInt("0x16345785D8A0000"); // 0.1 ETH
    let allowanceWei = CONSERVATIVE_ALLOWANCE_WEI;
    if (limit.isEnabled && limit.amount > 0) {
      const ethPrice = await getLiveUsdPrice("ETH");
      if (ethPrice > 0) {
        const ethAmount = limit.amount / ethPrice;
        const wei = toBaseUnits(ethAmount, 18);
        if (wei > BigInt(0)) allowanceWei = wei;
      }
    }
    const allowanceHex = `0x${allowanceWei.toString(16)}`;

    // 1inch v6 aggregation router on Ethereum mainnet — allows the session key to
    // execute swaps (native-input) while native spend stays bounded by the allowance.
    const ONEINCH_ROUTER_MAINNET = "0x111111125421cA6dc452d289314280a0f8842A65";

    // Authorize transfers of the ERC-20s the wallet currently holds, capped per
    // token at the same USD limit. Without a per-token erc20-token-transfer
    // permission the session key cannot move that token at all. Tokens acquired
    // later are covered the next time permissions are granted.
    const erc20Permissions = holdings
      .filter((h) => h.chain === 'ETH' && !h.isNative && h.address)
      .slice(0, 20) // keep the grant payload bounded
      .map((h) => {
        const capUsd = limit.isEnabled && limit.amount > 0 ? limit.amount : 0;
        // Cap at the USD limit where a price is known, else the held balance.
        const capTokens = capUsd > 0 && h.pricePerToken > 0
          ? Math.min(capUsd / h.pricePerToken, h.amount)
          : h.amount;
        const allowance = toBaseUnits(capTokens, h.decimals);
        return {
          type: "erc20-token-transfer",
          data: {
            allowance: `0x${allowance.toString(16)}`,
            address: h.address as `0x${string}`,
          },
        };
      });

    const permissions = await client.grantPermissions({
      account: evmAddress as `0x${string}`,
      expirySec: Math.floor(Date.now() / 1000) + 24 * 60 * 60,
      key: { publicKey: sessionKeyAddress as `0x${string}`, type: "secp256k1" },
      permissions: [
        { type: "native-token-transfer", data: { allowance: allowanceHex } },
        { type: "contract-access", data: { address: ONEINCH_ROUTER_MAINNET } },
        ...erc20Permissions,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any -- SDK permission union type
      ] as any,
    });

    const headers = await getAuthHeaders();
    const completeRes = await fetch("/api/ai/session", {
      method: "POST",
      headers,
      body: JSON.stringify({
        sessionPermissions: permissions,
        signerAddress: sessionKeyAddress,
        spendLimitUsd: limit.isEnabled ? limit.amount : 0,
        spendPeriod: limit.period,
      }),
    });
    const completeData = await completeRes.json();
    if (!completeRes.ok || completeData.status !== "active") {
      console.error("Session permission persist failed:", completeData);
      throw new Error(completeData.error || "Failed to install session permissions.");
    }
    return { erc20Count: erc20Permissions.length, completeData };
  }, [evmAddress, holdings, getAuthHeaders]);

  /**
   * Save settings locally. The spend limit only binds the agent once it is
   * granted on-chain, so a changed limit is flagged dirty until it is signed;
   * the default buy amount is a pure client preference and persists here.
   */
  const handleSavePreferences = useCallback((limit: SpendingLimit) => {
    if (limit.amount !== spendingLimit.amount || limit.period !== spendingLimit.period) {
      setLimitsDirty(true);
    }
    setSpendingLimit(limit);
    try {
      window.localStorage.setItem(
        PREFS_STORAGE_KEY,
        JSON.stringify({ defaultBuyAmountUSD: limit.defaultBuyAmountUSD }),
      );
    } catch {
      // storage unavailable (private mode) — preference just won't persist
    }
  }, [spendingLimit]);

  /**
   * Re-grant permissions with new limits from settings. This is the real
   * "sign new allowance" — it replaces the on-chain caps and resets the
   * server-side spend counter for the new period.
   */
  const handleApplyOnChainLimits = useCallback(async (limit: SpendingLimit) => {
    if (!sessionSignerAddress) {
      addLog('ERROR', "No active AI session to update. Activate AI mode first.");
      return;
    }
    setIsApplyingLimits(true);
    setOrbState('PROCESSING');
    try {
      addLog('SYSTEM', 'Updating on-chain limits — approve the signature request.');
      const client = await buildSmartWalletClient();
      const { erc20Count } = await grantAndPersistPermissions(client, sessionSignerAddress, limit);
      setSpendingLimit({ ...limit, currentUsage: 0 });
      setLimitsDirty(false);
      addLog(
        'SUCCESS',
        `On-chain limits updated: $${limit.amount} ${limit.period.toLowerCase()}${erc20Count > 0 ? `, ${erc20Count} token${erc20Count === 1 ? '' : 's'} authorized` : ''}.`,
      );
    } catch (error) {
      console.error("Applying on-chain limits failed:", error);
      addLog('ERROR', `Could not update limits: ${sanitizeError(error)}`);
    } finally {
      setIsApplyingLimits(false);
      setOrbState('IDLE');
    }
  }, [sessionSignerAddress, buildSmartWalletClient, grantAndPersistPermissions, addLog]);

  /** Activate AI mode: create session key + 7702 delegation via backend */
  const handleActivateAiMode = async () => {
    setOrbState('PROCESSING');
    try {
      const headers = await getAuthHeaders();
      const res = await fetch("/api/ai/session", {
        method: "POST",
        headers,
        body: JSON.stringify({}),
      });

      const data = await res.json();
      if (!res.ok) {
        addLog('ERROR', sanitizeError(data.error || "Failed to initialize AI session."));
        return;
      }

      if (data.status === "active") {
        setAiSessionStatus("active");
        if (data.message) addLog('SYSTEM', data.message);
        return;
      }

      if (data.status !== "needs_client_grant") {
        addLog('ERROR', "Unexpected session state. Please try again.");
        return;
      }

      // Client-side: delegate (if needed) + install session key permissions.
      const sessionKeyAddress: string | undefined = data.session?.signerAddress;
      if (!sessionKeyAddress || !evmAddress) {
        addLog('ERROR', "Missing session key or wallet address.");
        return;
      }

      const client = await buildSmartWalletClient();

      // A 7702-delegated EOA carries code of the form 0xef0100 || <implementation>.
      // Checking first lets a re-activation skip the delegation entirely (no extra
      // signature, no extra gas) when the account is already set up.
      const isAccountDelegated = async (): Promise<boolean> => {
        try {
          const codeRes = await fetch('/api/rpc?chain=ethereum', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              method: 'eth_getCode',
              params: [evmAddress, 'latest'],
            }),
          });
          const codeJson = await codeRes.json();
          return (
            typeof codeJson.result === 'string' &&
            codeJson.result.toLowerCase().startsWith('0xef0100')
          );
        } catch {
          return false;
        }
      };

      if (await isAccountDelegated()) {
        addLog('SYSTEM', 'Smart account already set up. Installing the AI session key — one signature.');
      } else {
        // Ensure 7702 delegation by sending an empty call set (no-op delegation flow).
        addLog('SYSTEM', 'Setting up your smart account — approve the signature request(s) that appear.');
        const prepared = await client.prepareCalls({
          calls: [],
          from: evmAddress as `0x${string}`,
        });
        const signed = await client.signPreparedCalls(prepared);
        const sent = await client.sendPreparedCalls(signed);

        // grantPermissions (wallet_createSession) is rejected with "7702 account
        // must be delegated" until the delegation user-op is actually mined, so
        // wait for it to land rather than racing it.
        addLog('SYSTEM', 'Delegation submitted — waiting for on-chain confirmation.');
        const delegationStatus = await client.waitForCallsStatus({ id: sent.id });
        if (delegationStatus.status !== 'success') {
          throw new Error(`DELEGATION_NOT_CONFIRMED_${delegationStatus.status ?? 'unknown'}`);
        }
        if (!(await isAccountDelegated())) {
          throw new Error('DELEGATION_NOT_VISIBLE');
        }
        addLog('SYSTEM', 'Smart account ready. Installing the AI session key — one more signature.');
      }

      const { erc20Count, completeData } = await grantAndPersistPermissions(
        client,
        sessionKeyAddress,
        spendingLimit,
      );
      if (erc20Count > 0) {
        addLog('SYSTEM', `Authorized AI transfers for ${erc20Count} token${erc20Count === 1 ? '' : 's'} you hold.`);
      }

      setAiSessionStatus("active");
      setSessionSignerAddress(sessionKeyAddress);
      setLimitsDirty(false);
      if (completeData.message) addLog('SYSTEM', completeData.message);
    } catch (error) {
      // The chat surfaces a sanitized message; keep the real error in the
      // console so live failures are diagnosable.
      console.error("AI activation failed:", error);
      addLog('ERROR', `Activation failed: ${sanitizeError(error)}`);
    } finally {
      setOrbState('IDLE');
    }
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
    if (!inputText.trim() || orbState === 'THINKING' || !evmAddress) return;

    if (inputText.trim() === 'CLEAR_LOGS') {
      setLogs([]);
      setInputText('');
      return;
    }

    if (inputText.trim() === 'SHOW_WALLET') {
      setInputText('');
      addLog('USER', '/wallet');
      const lines = [
        `ETH: ${evmAddress}`,
        `SOL: ${solAddress || 'Not available'}`,
      ];
      addLog('AGENT', lines.join('\n'));
      return;
    }

    // Answered straight from the holdings the agent already knows about — no
    // model round-trip, so it stays instant and free.
    if (inputText.trim() === 'SHOW_TOKENS') {
      setInputText('');
      addLog('USER', '/tokens');

      if (holdings.length === 0) {
        addLog(
          'AGENT',
          isLoadingHoldings
            ? "Still loading your balances — try /tokens again in a moment."
            : "No tokens with a balance on Ethereum or Solana yet.",
        );
        return;
      }

      const lines: string[] = [];
      ([['ETH', 'Ethereum'], ['SOL', 'Solana']] as const).forEach(([chainKey, label]) => {
        const owned = holdings.filter((h) => h.chain === chainKey);
        if (owned.length === 0) return;
        lines.push(`${label}:`);
        owned.forEach((h) => lines.push(`  • ${formatHoldingLine(h, false)}`));
      });

      const total = holdings.reduce((sum, h) => sum + h.usdValue, 0);
      if (total > 0) lines.push(`Total: ~$${total.toFixed(2)}`);
      if (isLoadingHoldings) lines.push('(still refreshing…)');

      addLog('AGENT', lines.join('\n'));
      return;
    }

    const cmd = inputText;
    setInputText('');
    addLog('USER', cmd);
    setOrbState('THINKING');
    setShowCommands(false);

    try {
      const headers = await getAuthHeaders();
      const commandRes = await fetch("/api/ai/parse", {
        method: "POST",
        headers,
        body: JSON.stringify({
          userText: cmd,
          wallet: {
            evmAddress,
            solAddress: solAddress || '',
            heldTokens: holdingsVocabulary(holdings),
          }
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
        if (chain !== "ETH" && chain !== "SOL") {
          chain = "ETH";
          addLog('SYSTEM', "AI mode currently supports only ETH and SOL. Defaulting to ETH.");
        }
        let amountUSD = command.amountUSD;

        // Auto-detect chain from Contract Address if provided
        if (command.contractAddress && !command.chain) {
          const detected = detectChainFromAddress(command.contractAddress);
          if (detected) chain = detected;
        }

        // Validation
        if (command.recipient && !validateAddress(chain, command.recipient)) {
          addLog('ERROR', "The address provided is not valid.");
          setOrbState('ERROR');
          setTimeout(() => setOrbState('IDLE'), 2000);
          return;
        }

        const nativeSymbol = chain === 'SOL' ? 'SOL' : 'ETH';
        const ownerAddress = chain === 'SOL' ? (solAddress || '') : evmAddress;

        // Which asset is moving? A named token must be one the wallet actually
        // holds; anything else is refused rather than guessed at.
        const namedToken = command.token && command.token.toUpperCase() !== nativeSymbol
          ? command.token
          : undefined;
        const holding = namedToken
          ? findHolding(holdings, namedToken, chain) ?? findHolding(holdings, namedToken)
          : undefined;

        if (namedToken && !holding) {
          addLog('ERROR', `You don't hold any ${namedToken} on ${chain === 'SOL' ? 'Solana' : 'Ethereum'}. Try /balance to see what's in your wallet.`);
          setOrbState('ERROR');
          setTimeout(() => setOrbState('IDLE'), 2000);
          return;
        }

        // A held token can live on the other supported chain (e.g. an SPL token
        // when the parser guessed ETH) — follow the holding.
        if (holding && holding.chain !== chain) {
          chain = holding.chain;
        }

        const isTokenTransfer = !!holding && !holding.isNative;
        const assetSymbol = holding?.symbol ?? nativeSymbol;
        const price = isTokenTransfer && holding.pricePerToken > 0
          ? holding.pricePerToken
          : await getLiveUsdPrice(chain);

        // Resolve the amount. The parser expresses it as a share of balance, a
        // token quantity, or a dollar figure — resolved here in that order,
        // because only the app knows balances and live prices.
        let amountToken = 0;

        if (typeof command.amountPercent === 'number' && command.amountPercent > 0) {
          const pct = Math.min(command.amountPercent, 100);

          // Prefer a fresh read when money is moving, but fall back to the
          // holdings figure rather than failing the whole command on a
          // transient RPC hiccup.
          let balance: number;
          if (isTokenTransfer) {
            balance = holding.amount;
          } else {
            const cachedNative = findHolding(holdings, nativeSymbol, chain)?.amount ?? 0;
            try {
              balance = await getNativeBalance(ownerAddress, chain);
            } catch {
              balance = cachedNative;
            }
          }

          if (!Number.isFinite(balance) || balance <= 0) {
            addLog('ERROR', `Could not read your ${assetSymbol} balance, or it is empty.`);
            setOrbState('ERROR');
            setTimeout(() => setOrbState('IDLE'), 2000);
            return;
          }

          amountToken = balance * (pct / 100);

          // Native sends must leave gas behind, or the transaction cannot be
          // paid for. Token transfers pay gas in the native asset, so their full
          // balance stays spendable.
          if (!isTokenTransfer) {
            const gasTarget = command.recipient || ownerAddress;
            // Fall back to a conservative reserve if estimation fails — sending
            // the whole balance with nothing left for fees is the worse outcome.
            let gasCost = chain === 'SOL' ? 0.00001 : 0.0003;
            try {
              gasCost = parseFloat(await estimateGasCost(chain, ownerAddress, gasTarget, 0)) || gasCost;
            } catch {
              // keep the conservative default
            }
            const reserve = gasCost * 1.2; // headroom for gas-price drift
            if (amountToken + reserve > balance) {
              amountToken = Math.max(balance - reserve, 0);
              addLog('SYSTEM', `Reserving ~${reserve.toFixed(6)} ${assetSymbol} for gas.`);
            }
          }

          if (amountToken <= 0) {
            addLog('ERROR', `Your ${assetSymbol} balance is too low to cover this send plus gas.`);
            setOrbState('ERROR');
            setTimeout(() => setOrbState('IDLE'), 2000);
            return;
          }

          addLog('SYSTEM', `${pct}% of your ${assetSymbol} balance = ${formatTokenAmount(amountToken)} ${assetSymbol}.`);
        } else if (typeof command.amountToken === 'number' && command.amountToken > 0) {
          amountToken = command.amountToken;
        } else if (amountUSD) {
          amountToken = price > 0 ? amountUSD / price : 0;
        }

        // Don't build a transfer the balance can't cover.
        if (isTokenTransfer && amountToken > holding.amount) {
          addLog('ERROR', `You only have ${formatTokenAmount(holding.amount)} ${assetSymbol}.`);
          setOrbState('ERROR');
          setTimeout(() => setOrbState('IDLE'), 2000);
          return;
        }

        // Buys default to the configured amount when none was given.
        if (amountToken <= 0 && command.intent === 'SWAP') {
          amountUSD = spendingLimit.defaultBuyAmountUSD;
          amountToken = price > 0 ? amountUSD / price : 0;
          addLog('SYSTEM', `Applying default buy amount: $${amountUSD}`);
        }

        // Never build a zero-value transfer: that used to happen silently
        // whenever the amount was phrased in tokens or as a share.
        if (amountToken <= 0) {
          addLog('ERROR', "I couldn't work out an amount from that. Try \"send 0.01 ETH to 0x…\", \"send $20 of ETH…\", or \"send half my ETH…\".");
          setOrbState('ERROR');
          setTimeout(() => setOrbState('IDLE'), 2000);
          return;
        }

        // Keep the USD figure in step with whatever the amount resolved to, so
        // the confirmation card and spend accounting agree.
        amountUSD =
          typeof command.amountUSD === 'number' && command.amountUSD > 0
            ? command.amountUSD
            : amountToken * price;

        const newTx: Transaction = {
          id: uuidv4(),
          type: command.intent,
          chain,
          targetChain: command.targetChain,
          amount: amountToken,
          amountUSD: amountUSD || 0,
          token: assetSymbol,
          targetToken: command.targetToken,
          recipient: command.recipient,
          contractAddress: command.contractAddress,
          tokenAddress: isTokenTransfer ? holding.address : undefined,
          tokenDecimals: isTokenTransfer ? holding.decimals : undefined,
          timestamp: Date.now(),
          status: 'ESTIMATING_GAS',
          riskLevel: command.riskAssessment,
          technicalSummary: command.technicalSummary
        };

        setActiveTx(newTx);
        addLog('AGENT', command.reply);

        // Gas estimation
        const targetAddr = command.recipient || command.contractAddress || "0x0000000";
        const fromAddr = chain === 'SOL' ? (solAddress || '') : evmAddress;
        const gas = await estimateGasCost(chain, fromAddr, targetAddr, amountToken);
        setActiveTx(prev => prev ? ({ ...prev, gasEstimate: gas, status: 'NEEDS_APPROVAL' }) : null);

      } else {
        setOrbState('IDLE');
        if (command.intent === 'BALANCE') {
          let chain = (command.chain || 'ETH') as Chain;
          if (chain !== "ETH" && chain !== "SOL") {
            chain = "ETH";
            addLog('SYSTEM', "AI mode currently supports only ETH and SOL. Defaulting to ETH.");
          }
          // Someone else's address: only the native balance is knowable.
          if (command.recipient) {
            try {
              const bal = await getNativeBalance(command.recipient, chain);
              addLog('AGENT', `${shortenAddress(command.recipient)} holds ${bal.toFixed(4)} ${chain}.`);
            } catch {
              addLog('ERROR', "Could not fetch balance.");
            }
          } else if (command.token) {
            // A specific token in the user's own wallet.
            const wanted = findHolding(holdings, command.token, chain) ?? findHolding(holdings, command.token);
            if (wanted) {
              addLog('AGENT', `You hold ${formatHoldingLine(wanted)}.`);
            } else {
              addLog('AGENT', `No ${command.token} in your wallet.`);
            }
          } else {
            // Everything the wallet holds, richest first.
            const owned = command.chain
              ? holdings.filter((h) => h.chain === chain)
              : holdings;
            if (owned.length === 0) {
              addLog('AGENT', "Your wallet is empty on the chains AI mode covers (Ethereum and Solana).");
            } else {
              const total = owned.reduce((sum, h) => sum + h.usdValue, 0);
              const lines = owned.slice(0, 12).map((h) => `• ${formatHoldingLine(h)}`);
              if (total > 0) lines.push(`Total: ~$${total.toFixed(2)}`);
              addLog('AGENT', lines.join('\n'));
            }
          }
        } else if (command.intent === 'HISTORY') {
          addLog('AGENT', command.reply || "Fetching transaction history...");

          const limit = command.limit || 5;
          const results: string[] = [];

          if (command.chain) {
            let chain = command.chain as Chain;
            if (chain !== "ETH" && chain !== "SOL") {
              chain = "ETH";
              addLog('SYSTEM', "AI mode currently supports only ETH and SOL. Defaulting to ETH.");
            }
            const targetAddr = command.recipient || (chain === 'SOL' ? (solAddress || '') : evmAddress);
            const txs = await getTransactionHistory(chain, targetAddr, limit);
            if (txs.length === 0) {
              results.push(`${chain}: No recent transactions found.`);
            } else {
              results.push(`${chain} History (${targetAddr.slice(0, 6)}...):`);
              txs.forEach(tx => results.push(`• ${shortenAddress(tx.hash)} | ${tx.success ? 'OK' : 'FAIL'}`));
            }
          } else {
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
              const [solTxs, ethTxs] = await Promise.all([
                solAddress ? getTransactionHistory('SOL', solAddress, limit) : Promise.resolve([]),
                getTransactionHistory('ETH', evmAddress, limit)
              ]);

              results.push(`SOL History (${limit} latest):`);
              if (solTxs.length) solTxs.forEach(tx => results.push(`• ${shortenAddress(tx.hash)}`));
              else results.push("No transactions.");

              results.push(`ETH History (${limit} latest):`);
              if (ethTxs.length) ethTxs.forEach(tx => results.push(`• ${shortenAddress(tx.hash)}`));
              else results.push("No transactions.");
            }
          }

          addLog('AGENT', results.join('\n'));

        } else if (command.intent === 'HISTORY_SUMMARY') {
          const headers = await getAuthHeaders();
          const summaryRes = await fetch("/api/ai/summarize", {
            method: "POST",
            headers,
            body: JSON.stringify({ history: transactions })
          });

          if (!summaryRes.ok) {
            throw new Error(`AI_SUMMARY_FAILED_${summaryRes.status}`);
          }

          const data = (await summaryRes.json()) as { summary?: string };
          addLog('AGENT', data.summary || "Summary unavailable.");
        } else {
          addLog('AGENT', command.reply);
        }
      }

    } catch (error) {
      addLog('ERROR', sanitizeError(error));
      setOrbState('ERROR');
      setTimeout(() => setOrbState('IDLE'), 2000);
    }
  };

  /** Execute a confirmed transaction via the backend session key */
  const handleExecuteTx = async (tx: Transaction) => {
    if (!evmAddress) return;

    setActiveTx(prev => prev ? ({ ...prev, status: 'BROADCASTING' }) : null);
    setOrbState('PROCESSING');

    try {
      // Solana is EVM-7702-incompatible, so autonomous session-key execution does not
      // apply. Native SOL sends run through the user's Privy Solana wallet (user-signed).
      // Solana swaps remain a separate design and are surfaced as unsupported for now.
      if (tx.chain === 'SOL') {
        if (tx.type !== 'SEND' || !tx.recipient) {
          addLog('SYSTEM', "Solana swaps aren't supported in AI mode yet. Try a send, or use manual mode.");
          setActiveTx(prev => prev ? ({ ...prev, status: 'FAILED', error: 'Solana AI swap not yet supported.' }) : null);
          setOrbState('ERROR');
          setTimeout(() => setOrbState('IDLE'), 2000);
          return;
        }

        const solWallet = pickSolanaWallet(solanaWallets);
        if (!solWallet?.address) {
          throw new Error("Solana wallet not connected");
        }

        const fromPubkey = new PublicKey(solWallet.address);
        const toPubkey = new PublicKey(tx.recipient);

        const transaction = new SolTransaction();
        if (tx.tokenAddress) {
          // SPL token transfer: mirrors the manual flow, including creating the
          // recipient's associated token account when they've never held it.
          const { getAssociatedTokenAddress, createTransferInstruction, createAssociatedTokenAccountIdempotentInstruction } =
            await import("@solana/spl-token");
          const mintPubkey = new PublicKey(tx.tokenAddress);
          const decimals = tx.tokenDecimals ?? 9;
          const fromTokenAccount = await getAssociatedTokenAddress(mintPubkey, fromPubkey);
          const toTokenAccount = await getAssociatedTokenAddress(mintPubkey, toPubkey);

          transaction.add(
            createAssociatedTokenAccountIdempotentInstruction(
              fromPubkey,
              toTokenAccount,
              toPubkey,
              mintPubkey,
            ),
            createTransferInstruction(
              fromTokenAccount,
              toTokenAccount,
              fromPubkey,
              Number(toBaseUnits(tx.amount, decimals)),
            ),
          );
        } else {
          transaction.add(
            SystemProgram.transfer({
              fromPubkey,
              toPubkey,
              lamports: Number(toBaseUnits(tx.amount, 9)),
            }),
          );
        }

        // Recent blockhash (same proxied source as the manual Solana send flow).
        transaction.recentBlockhash = await solanaClient.getLatestBlockhash();
        transaction.feePayer = fromPubkey;

        // Wallet-standard signing: serialized bytes in, signed bytes out.
        const unsignedBytes = transaction.serialize({
          requireAllSignatures: false,
          verifySignatures: false,
        });
        const signedBytes = await signSolanaTransactionBytes(
          solWallet,
          new Uint8Array(unsignedBytes)
        );
        const signature = await solanaClient.sendRawTransaction(
          Buffer.from(signedBytes).toString('base64')
        );

        const completedTx = { ...tx, status: 'COMPLETED' as const, hash: signature };
        setActiveTx(completedTx);
        setTransactions(prev => [...prev, completedTx]);
        setSpendingLimit(prev => ({ ...prev, currentUsage: prev.currentUsage + tx.amountUSD }));
        addLog('SUCCESS', `Confirmed. Hash: ${signature.slice(0, 10)}...`);
        setOrbState('IDLE');
        return;
      }

      // EVM: Execute via backend session key
      const headers = await getAuthHeaders();

      // Build the calls array based on transaction type
      const calls: Array<{ to: string; value?: string; data?: string }> = [];
      if (tx.type === 'SEND' && tx.recipient) {
        if (tx.tokenAddress) {
          // ERC-20 send: call transfer() on the token itself. The session key can
          // only do this when the grant carries an erc20-token-transfer permission
          // for this token (installed at activation from the held balances).
          const data = encodeFunctionData({
            abi: parseAbi(['function transfer(address to, uint256 amount) returns (bool)']),
            functionName: 'transfer',
            args: [
              tx.recipient as `0x${string}`,
              toBaseUnits(tx.amount, tx.tokenDecimals ?? 18),
            ],
          });
          calls.push({ to: tx.tokenAddress, value: '0x0', data });
        } else {
          // Native token send
          const valueWei = toBaseUnits(tx.amount, 18);
          calls.push({
            to: tx.recipient,
            value: `0x${valueWei.toString(16)}`,
            data: '0x',
          });
        }
      } else if (tx.type === 'SWAP' || tx.type === 'BRIDGE') {
        // Real swap calldata from the 1inch aggregation API. Supported today:
        // native ETH -> token (the "buy" path), where the destination token address
        // is known. ERC-20 source tokens need an approval + erc20 permission and are
        // surfaced as unsupported rather than sent as an unsafe placeholder.
        const NATIVE = "0xEeeeeEeeeEeEeeEeEeEeeEEEeeeeEeeeeeeeEEeE";
        const isNativeSource = !tx.token || tx.token.toUpperCase() === 'ETH';
        const dstToken = tx.contractAddress;

        if (!isNativeSource) {
          throw new Error("SWAP_UNSUPPORTED_ERC20_SOURCE");
        }
        if (!dstToken || !validateAddress('ETH', dstToken)) {
          throw new Error("SWAP_MISSING_DEST_TOKEN");
        }

        const amountWei = toBaseUnits(tx.amount, 18).toString();
        const params = new URLSearchParams({
          chainId: "1",
          src: NATIVE,
          dst: dstToken,
          amount: amountWei,
          from: evmAddress,
          slippage: "1",
          disableEstimate: "true",
        });
        const swapRes = await fetch(`/api/1inch/swap?${params.toString()}`, { headers });
        const swapData = await swapRes.json();
        if (!swapRes.ok || !swapData?.tx?.to || !swapData?.tx?.data) {
          throw new Error(swapData?.error || "Failed to build swap transaction.");
        }
        const swapValue = swapData.tx.value ? BigInt(swapData.tx.value) : BigInt(0);
        calls.push({
          to: swapData.tx.to,
          data: swapData.tx.data,
          value: `0x${swapValue.toString(16)}`,
        });
      }

      const res = await fetch("/api/ai/execute", {
        method: "POST",
        headers,
        body: JSON.stringify({ calls, amountUsd: tx.amountUSD }),
      });

      const data = await res.json();

      if (res.ok && data.status === 'success') {
        const receiptHash = data.result?.receipts?.[0]?.transactionHash;
        const isConfirmed = typeof receiptHash === 'string' && receiptHash.length > 0;
        const hash = receiptHash || data.result?.id || 'pending';
        const resolvedTx = {
          ...tx,
          status: (isConfirmed ? 'COMPLETED' : 'BROADCASTING') as 'COMPLETED' | 'BROADCASTING',
          hash,
        };

        setActiveTx(resolvedTx);
        setTransactions(prev => [...prev, resolvedTx]);
        setSpendingLimit(prev => ({ ...prev, currentUsage: prev.currentUsage + tx.amountUSD }));

        if (isConfirmed) {
          addLog('SUCCESS', `Confirmed. Hash: ${hash.slice(0, 10)}...`);
        } else {
          addLog('SYSTEM', `Submitted. Awaiting confirmation (${String(hash).slice(0, 10)}...)`);
        }
        setOrbState('IDLE');
      } else {
        throw new Error(data.error || 'Transaction execution failed');
      }
    } catch (error) {
      const message = sanitizeError(error);
      addLog('ERROR', message);
      setOrbState('ERROR');
      setActiveTx(prev => prev ? ({ ...prev, status: 'FAILED', error: message }) : null);
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

  // If user has no EVM wallet or AI session is not active, show the splash page
  if (!evmAddress || (aiSessionStatus !== 'active' && aiSessionStatus !== 'unknown')) return (
    <div className="h-full w-full bg-transparent text-[color:var(--color-depth)] flex flex-col overflow-hidden">
      <div className="flex items-center justify-between px-4 pt-1 pb-0 sm:px-6 sm:pt-2 z-30 shrink-0">
        <div />
        <ModeToggle />
      </div>
      <div className="flex-1 min-h-0">
        <SplashPage onGenerate={handleActivateAiMode} isGenerating={orbState === 'PROCESSING'} />
      </div>
    </div>
  );

  // Still checking session status
  if (aiSessionStatus === 'unknown') return (
    <div className="h-full w-full bg-transparent text-[color:var(--color-depth)] flex items-center justify-center">
      <div className="text-xs text-[color:var(--color-depth)]/50 animate-pulse tracking-widest uppercase">
        Loading...
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
          onUpdateLimit={handleSavePreferences}
          onApplyOnChain={handleApplyOnChainLimits}
          isSessionActive={aiSessionStatus === 'active' && !!sessionSignerAddress}
          isApplying={isApplyingLimits}
          limitsDirty={limitsDirty}
        />
      )}
      <HelpModal isOpen={isHelpOpen} onClose={() => setIsHelpOpen(false)} />

      {/* ── ORB — z-0 background ── */}
      <div className="absolute inset-0 z-0 flex items-center justify-center pointer-events-none opacity-80">
        <div className="relative w-[min(110vw,520px)] h-[min(110vw,520px)] max-h-[70vh] sm:w-[min(70vw,680px)] sm:h-[min(70vw,680px)] md:w-[800px] md:h-[800px] -translate-y-[10%] sm:-translate-y-[8%] md:-translate-y-[6%]">
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
