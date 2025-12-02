import { TokenBalance, EVMChain } from "./wallet/data";

// Type definitions for API responses
export interface OneInchQuote {
  toTokenAmount: string;
  tx: {
    from: string;
    to: string;
    data: string;
    value: string;
    gasPrice: string;
    gas: string;
  };
}

export interface JupiterSwapRoute {
  outAmount: string; // The amount of output tokens you would receive
  marketInfos: any[]; // Detailed information about the markets used in the route
  swapMode: string; // The swap mode (e.g., ExactIn, ExactOut)
}

export interface JupiterSwapTransaction {
  swapTransaction: string; // Base64 encoded transaction
}

// 1inch API configuration
const ONE_INCH_API_BASE_URL = "https://api.1inch.io/v5.0";

const ONE_INCH_CHAIN_IDS: Record<EVMChain, number> = {
  ethereum: 1,
  bsc: 56,
  polygon: 137,
  arbitrum: 42161,
  optimism: 10,
  base: 8453,
};

// Jupiter API configuration
const JUPITER_API_BASE_URL = "https://quote-api.jup.ag/v6";

// --- EVM Swap Functions (1inch) ---

export async function fetchOneInchQuote(
  chain: EVMChain,
  fromToken: TokenBalance,
  toToken: TokenBalance,
  amount: string
): Promise<OneInchQuote | null> {
  const chainId = ONE_INCH_CHAIN_IDS[chain];
  if (!chainId || !fromToken.contractAddress || !toToken.contractAddress) {
    throw new Error("Invalid EVM chain or missing contract addresses for 1inch quote.");
  }

  const encodedAmount = Math.floor(parseFloat(amount) * (10 ** 18)).toString(); // Assuming 18 decimal places for simplicity, need actual token decimals

  const url =
    `${ONE_INCH_API_BASE_URL}/${chainId}/quote` +
    `?fromTokenAddress=${fromToken.contractAddress}` +
    `&toTokenAddress=${toToken.contractAddress}` +
    `&amount=${encodedAmount}`;

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`1inch API error: ${response.statusText}`);
    }
    const data: OneInchQuote = await response.json();
    // 1inch returns amount in smallest unit. Convert back to readable format.
    const toTokenAmount = parseFloat(data.toTokenAmount) / (10 ** 18); // Assuming 18 decimals
    return { ...data, toTokenAmount: toTokenAmount.toString() };
  } catch (error) {
    console.error("Error fetching 1inch quote:", error);
    return null;
  }
}

export async function getOneInchSwapTransaction(
  chain: EVMChain,
  fromToken: TokenBalance,
  toToken: TokenBalance,
  amount: string,
  fromAddress: string,
  slippage: number // e.g., 0.5 for 0.5%
): Promise<OneInchQuote["tx"] | null> {
  const chainId = ONE_INCH_CHAIN_IDS[chain];
  if (!chainId || !fromToken.contractAddress || !toToken.contractAddress) {
    throw new Error("Invalid EVM chain or missing contract addresses for 1inch swap.");
  }

  const encodedAmount = Math.floor(parseFloat(amount) * (10 ** 18)).toString(); // Assuming 18 decimals

  const url =
    `${ONE_INCH_API_BASE_URL}/${chainId}/swap` +
    `?fromTokenAddress=${fromToken.contractAddress}` +
    `&toTokenAddress=${toToken.contractAddress}` +
    `&amount=${encodedAmount}` +
    `&fromAddress=${fromAddress}` +
    `&slippage=${slippage}` +
    `&disableEstimate=true`; // Disable 1inch gas estimate to use local one if needed

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`1inch API error: ${response.statusText}`);
    }
    const data: { tx: OneInchQuote["tx"] } = await response.json();
    return data.tx;
  } catch (error) {
    console.error("Error fetching 1inch swap transaction:", error);
    return null;
  }
}

// --- Solana Swap Functions (Jupiter) ---

export async function fetchJupiterQuote(
  fromTokenMint: string,
  toTokenMint: string,
  amount: string // User-entered amount in readable format
): Promise<JupiterSwapRoute | null> {
  // For Jupiter, amount needs to be in lamports (smallest unit)
  // Need to know the decimals of the fromToken. For simplicity, assuming 6 for USDC/USDT on Solana, 9 for SOL
  const fromTokenDecimals = fromTokenMint === "So11111111111111111111111111111111111111112" ? 9 : 6;
  const encodedAmount = Math.floor(parseFloat(amount) * (10 ** fromTokenDecimals)).toString();

  const url =
    `${JUPITER_API_BASE_URL}/quote` +
    `?inputMint=${fromTokenMint}` +
    `&outputMint=${toTokenMint}` +
    `&amount=${encodedAmount}` +
    `&slippageBps=50`; // 50 bps = 0.5% slippage

  try {
    const response = await fetch(url);
    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.statusText}`);
    }
    const data: { data: JupiterSwapRoute[] } = await response.json();
    if (data.data && data.data.length > 0) {
      // Jupiter returns outAmount in smallest unit. Convert back to readable format.
      const toTokenDecimals = toTokenMint === "So11111111111111111111111111111111111111112" ? 9 : 6; // Assuming 6 for tokens, 9 for SOL
      const outAmount = parseFloat(data.data[0].outAmount) / (10 ** toTokenDecimals);
      return { ...data.data[0], outAmount: outAmount.toString() };
    }
    return null;
  } catch (error) {
    console.error("Error fetching Jupiter quote:", error);
    return null;
  }
}

export async function getJupiterSwapTransaction(
  quote: JupiterSwapRoute,
  userPublicKey: string
): Promise<JupiterSwapTransaction | null> {
  const url = `${JUPITER_API_BASE_URL}/swap`;

  try {
    const response = await fetch(url, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        quoteResponse: quote,
        userPublicKey: userPublicKey,
        wrapUnwrapSOL: true, // Auto wrap/unwrap SOL for convenience
      }),
    });

    if (!response.ok) {
      throw new Error(`Jupiter API error: ${response.statusText}`);
    }

    const data: JupiterSwapTransaction = await response.json();
    return data;
  } catch (error) {
    console.error("Error fetching Jupiter swap transaction:", error);
    return null;
  }
}
