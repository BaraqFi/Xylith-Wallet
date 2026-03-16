"use client";

import { usePrivy } from "@privy-io/react-auth";

interface UseSmartWalletClientResult {
  isSmartWalletReady: boolean;
  embeddedEoaAddress?: string;
}

/**
 * Hook to access the user's embedded EOA wallet address.
 * SmartWalletsProvider has been replaced — EIP-7702 delegation and session keys
 * are now handled server-side via Alchemy Account Kit API routes.
 */
export function useSmartWalletClient(): UseSmartWalletClientResult {
  const { user, ready } = usePrivy();

  const embeddedWallet = user?.linkedAccounts?.find(
    (account) =>
      account.type === "wallet" &&
      "chainType" in account &&
      account.chainType === "ethereum" &&
      "walletClientType" in account &&
      account.walletClientType === "privy"
  );

  const embeddedEoaAddress =
    embeddedWallet && "address" in embeddedWallet
      ? (embeddedWallet.address as string)
      : undefined;

  return {
    isSmartWalletReady: Boolean(ready && embeddedEoaAddress),
    embeddedEoaAddress,
  };
}
