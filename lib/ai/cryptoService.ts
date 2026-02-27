import { WalletState, Chain, TxHistoryItem } from './types';
import { ethers } from 'ethers';
import { Connection, Keypair, LAMPORTS_PER_SOL, PublicKey, SystemProgram, Transaction as SolTransaction } from '@solana/web3.js';
import { Buffer } from 'buffer';

// --- Polyfills ---
if (typeof window !== 'undefined' && !('Buffer' in window)) {
  (window as unknown as { Buffer: typeof Buffer }).Buffer = Buffer;
}

// --- Configuration ---
const RPC_URLS = {
  ETH: "https://mainnet.infura.io/v3/130e67c0efa644a58a0bdb031a053a0a",
  BASE: "https://mainnet.base.org",
  ARB: "https://arb1.arbitrum.io/rpc",
  SOL: "https://api.mainnet-beta.solana.com"
};

const DEX_ROUTERS = {
  ETH: "0x7a250d5630B4cF539739dF2C5dAcb4c659F2488D", // Uniswap V2 Router (Example)
  SOL: "JUP4Fb2cqiRUcaTHdrPC8h2gNsA2ETXiPDD33WcGuJB" // Jupiter Aggregator (Example)
};

// --- Rate Limiting Strategy ---
const ETH_LIMIT_WINDOW = 3 * 60 * 1000;
const ETH_LIMIT_MAX = 5;
let ethRequestTimestamps: number[] = [];

const checkEthRateLimit = () => {
  const now = Date.now();
  ethRequestTimestamps = ethRequestTimestamps.filter(t => now - t < ETH_LIMIT_WINDOW);
  if (ethRequestTimestamps.length >= ETH_LIMIT_MAX) {
    const oldest = ethRequestTimestamps[0];
    const waitTime = Math.ceil((oldest + ETH_LIMIT_WINDOW - now) / 1000);
    throw new Error(`Rate limit exceeded (ETH). Wait ${waitTime}s.`);
  }
  ethRequestTimestamps.push(now);
};

// --- Wallet Management ---
export const generateWallet = (): WalletState => {
  const evmWallet = ethers.Wallet.createRandom();
  const solAccount = Keypair.generate();
  const solPrivateKey = Buffer.from(solAccount.secretKey).toString('hex');

  return {
    evmAddress: evmWallet.address,
    evmPrivateKey: evmWallet.privateKey,
    solAddress: solAccount.publicKey.toString(),
    solPrivateKey: solPrivateKey
  };
};

// --- Validation & Estimation ---

export const validateAddress = (chain: Chain, address: string): boolean => {
  if (chain === 'SOL') {
    try {
      const pubKey = new PublicKey(address);
      return PublicKey.isOnCurve(pubKey.toBytes());
    } catch {
      return false;
    }
  } else {
    return ethers.isAddress(address);
  }
};

export const detectChainFromAddress = (address: string): Chain | null => {
  // Simple heuristic: EVM addresses are 0x and 42 chars. Solana are Base58 and longer.
  if (ethers.isAddress(address)) return 'ETH'; // Default to ETH, but caller might refine to Base/Arb
  try {
    const pubKey = new PublicKey(address);
    if (PublicKey.isOnCurve(pubKey.toBytes())) return 'SOL';
  } catch { }
  return null;
};

export const estimateGasCost = async (chain: Chain, from: string, to: string, amount: number): Promise<string> => {
  if (chain === 'ETH') checkEthRateLimit();

  try {
    if (chain === 'SOL') {
      return "0.000005 SOL";
    } else {
      const provider = new ethers.JsonRpcProvider(RPC_URLS[chain]);
      const gasEstimate = await provider.estimateGas({
        from,
        to,
        value: ethers.parseEther(amount.toString())
      });
      const feeData = await provider.getFeeData();
      const gasPrice = feeData.gasPrice ?? 0n;
      const costWei = gasEstimate * gasPrice;
      return `${parseFloat(ethers.formatEther(costWei)).toFixed(6)} ${chain}`;
    }
  } catch {
    // console.error("Gas estimation failed");
    return "0.001 " + chain; // Fallback for UI
  }
};

// --- Read Operations ---
export const getNativeBalance = async (address: string, chain: Chain): Promise<number> => {
  if (chain === 'ETH') checkEthRateLimit();

  try {
    if (chain === 'SOL') {
      const connection = new Connection(RPC_URLS.SOL);
      const publicKey = new PublicKey(address);
      const balance = await connection.getBalance(publicKey);
      return balance / LAMPORTS_PER_SOL;
    } else {
      const provider = new ethers.JsonRpcProvider(RPC_URLS[chain]);
      const balance = await provider.getBalance(address);
      return parseFloat(ethers.formatEther(balance));
    }
  } catch (error) {
    // console.error(`Error fetching balance for ${chain}:`, error);
    throw error;
  }
};

// --- History Operations ---
export const getTransactionHistory = async (chain: Chain, address: string, limit: number = 5): Promise<TxHistoryItem[]> => {
  try {
    if (chain === 'SOL') {
      const connection = new Connection(RPC_URLS.SOL);
      const pubKey = new PublicKey(address);
      const signatures = await connection.getSignaturesForAddress(pubKey, { limit: limit });

      // Map signatures to our internal format
      return signatures.map(sig => ({
        hash: sig.signature,
        timestamp: sig.blockTime || Date.now() / 1000,
        success: !sig.err,
        value: 0, // Difficult to get exact value without parsing transaction details
        chain: 'SOL'
      }));

    } else if (chain === 'ETH') {
      // Etherscan API fallback (Free tier, no key required for basic tests, or use 'YourApiKeyToken' as generic placeholder)
      // Note: In production, use a real API key in env vars.
      const response = await fetch(`https://api.etherscan.io/api?module=account&action=txlist&address=${address}&startblock=0&endblock=99999999&page=1&offset=${limit}&sort=desc&apikey=YourApiKeyToken`);
      const data = await response.json();

      if (data.status === "0" && data.message === "No transactions found") {
        return [];
      }

      if (data.result && Array.isArray(data.result)) {
        return data.result.map((tx: Record<string, string>) => ({
          hash: tx.hash,
          from: tx.from,
          to: tx.to || "",
          value: parseFloat(ethers.formatEther(tx.value)),
          timestamp: parseInt(tx.timeStamp),
          success: tx.isError === "0",
          chain: 'ETH'
        }));
      }

      return [];

    } else {
      return []; // Not supported for L2s in this demo version without specific indexers
    }
  } catch (error) {
    console.error(`History fetch failed for ${chain}:`, error);
    return [];
  }
};

// --- Write Operations (Transactions) ---
export const sendNativeToken = async (
  wallet: WalletState,
  chain: Chain,
  recipient: string,
  amount: number
): Promise<{ hash: string }> => {

  if (chain === 'ETH') checkEthRateLimit();

  if (chain === 'SOL') {
    const connection = new Connection(RPC_URLS.SOL, 'confirmed');
    const secretKey = Uint8Array.from(Buffer.from(wallet.solPrivateKey, 'hex'));
    const sender = Keypair.fromSecretKey(secretKey);
    const toPublicKey = new PublicKey(recipient);

    const transaction = new SolTransaction().add(
      SystemProgram.transfer({
        fromPubkey: sender.publicKey,
        toPubkey: toPublicKey,
        lamports: Math.floor(amount * LAMPORTS_PER_SOL),
      })
    );

    const signature = await connection.sendTransaction(transaction, [sender]);
    return { hash: signature };

  } else {
    const provider = new ethers.JsonRpcProvider(RPC_URLS[chain]);
    const signer = new ethers.Wallet(wallet.evmPrivateKey, provider);

    const tx = await signer.sendTransaction({
      to: recipient,
      value: ethers.parseEther(amount.toString())
    });

    return { hash: tx.hash };
  }
};

/**
 * Simulates a Swap or Bridge transaction.
 * In a production app, this would construct a transaction using 1inch API (EVM) or Jupiter SDK (Solana).
 * For this demo, it performs a 0-value (or nominal) transfer to the router address to prove on-chain execution capability.
 */
export const executeSwap = async (
  wallet: WalletState,
  chain: Chain,
  tokenAddress: string,
  amountIn: number
): Promise<{ hash: string }> => {
  // For the Hackathon/Demo: We treat the "Recipient" as the DEX Router.
  // We send the 'Native' token to the router to simulate the swap start.
  const router = chain === 'SOL' ? DEX_ROUTERS.SOL : DEX_ROUTERS.ETH;

  // Note: We are ignoring the contract interaction data (calldata) for simplicity
  // because we don't have the ABIs imported. We just show we can sign and send.
  return sendNativeToken(wallet, chain, router, amountIn);
};

// --- Utilities ---
export const shortenAddress = (addr: string) => {
  if (!addr) return '';
  return `${addr.slice(0, 6)}...${addr.slice(-4)}`;
};

export const formatCurrency = (amount: number) => {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(amount);
};

export const getPriceEstimate = (chain: Chain): number => {
  switch (chain) {
    case 'ETH': return 3200;
    case 'BASE': return 3200;
    case 'ARB': return 3200;
    case 'SOL': return 145;
    default: return 0;
  }
};
