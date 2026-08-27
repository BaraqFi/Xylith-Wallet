import { solanaClient } from "./client";

/** Base fee per signature on Solana, in lamports. */
export const SIGNATURE_FEE_LAMPORTS = 5000;

/**
 * Rent-exempt minimum for a token account (~0.00203928 SOL). Paid by the sender
 * when the recipient has never held the token before.
 */
export const ATA_RENT_LAMPORTS = 2_039_280;

export const LAMPORTS_PER_SOL = 1_000_000_000;

export interface SolanaFeeEstimate {
  /** Total lamports the sender pays in fees (excluding the transfer amount). */
  lamports: number;
  /** Whether the recipient's token account has to be created. */
  createsRecipientAccount: boolean;
}

/**
 * Estimate what a transfer will cost the sender.
 *
 * Solana fees are deterministic rather than auction-priced: one signature at a
 * fixed rate, plus rent if the transfer has to open a token account for the
 * recipient. That second part dominates — it is ~400x the signature fee — so it
 * is worth showing the user before they confirm.
 */
export async function estimateSolanaTransferFee(
  recipientTokenAccount?: string,
): Promise<SolanaFeeEstimate> {
  if (!recipientTokenAccount) {
    return { lamports: SIGNATURE_FEE_LAMPORTS, createsRecipientAccount: false };
  }

  const exists = await solanaClient.accountExists(recipientTokenAccount);
  return {
    lamports: SIGNATURE_FEE_LAMPORTS + (exists ? 0 : ATA_RENT_LAMPORTS),
    createsRecipientAccount: !exists,
  };
}

/** Lamports as a SOL string, trimmed of trailing zeros. */
export function lamportsToSol(lamports: number): string {
  return (lamports / LAMPORTS_PER_SOL).toFixed(9).replace(/\.?0+$/, "");
}
