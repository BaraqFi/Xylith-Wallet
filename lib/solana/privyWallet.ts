import type { ConnectedStandardSolanaWallet } from "@privy-io/react-auth/solana";

/**
 * Pick the wallet to sign with from Privy's Solana standard-wallet list,
 * preferring the Privy embedded wallet over externally connected ones.
 *
 * NOTE: Solana wallets are NOT returned by `useWallets()` from
 * `@privy-io/react-auth` (that hook is Ethereum-only). Callers must pass the
 * list from `useWallets()` in `@privy-io/react-auth/solana`.
 */
export function pickSolanaWallet(
  wallets: ConnectedStandardSolanaWallet[],
): ConnectedStandardSolanaWallet | undefined {
  const embedded = wallets.find((w) => {
    const standard = w.standardWallet as { isPrivyWallet?: boolean };
    return standard?.isPrivyWallet === true;
  });
  return embedded ?? wallets[0];
}

/**
 * Sign an already-serialized transaction (legacy or versioned wire format)
 * with a Privy Solana standard wallet. Wallet-standard signing works on raw
 * bytes in and raw bytes out — never pass a web3.js Transaction object.
 */
export async function signSolanaTransactionBytes(
  wallet: ConnectedStandardSolanaWallet,
  transactionBytes: Uint8Array,
): Promise<Uint8Array> {
  const { signedTransaction } = await wallet.signTransaction({
    transaction: transactionBytes,
  });
  return signedTransaction;
}
