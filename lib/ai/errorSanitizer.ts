/**
 * Sanitizes raw errors into user-friendly messages.
 * Never exposes stack traces, internal codes, or raw provider errors to the frontend.
 */

const ERROR_MAP: [RegExp, string][] = [
    [/insufficient funds|INSUFFICIENT_FUNDS/i, "Not enough balance to complete this transaction."],
    [/nonce.*too low|NONCE_EXPIRED/i, "A previous transaction is still processing. Please wait a moment and try again."],
    [/gas required exceeds allowance|UNPREDICTABLE_GAS_LIMIT/i, "This transaction may fail on-chain. Please check amounts and try again."],
    [/user rejected|ACTION_REJECTED/i, "Transaction was cancelled."],
    [/session.*expired|SESSION_EXPIRED/i, "Your AI session has expired. Please re-activate AI mode."],
    [/session.*not found|NO_SESSION/i, "AI session not found. Please activate AI mode first."],
    [/rate limit|429|TOO_MANY_REQUESTS/i, "Too many requests — please slow down and try again shortly."],
    [/network|ECONNREFUSED|ETIMEDOUT|fetch failed/i, "Network connection issue. Please check your connection and try again."],
    [/unauthorized|401|UNAUTHENTICATED/i, "Authentication error. Please log in again."],
    [/spending.*cap|SPENDING_LIMIT/i, "This transaction would exceed your spending limit."],
    [/invalid.*address/i, "The address provided is not valid."],
    [/reverted|CALL_EXCEPTION/i, "Transaction would fail on-chain. The contract rejected the operation."],
    [/SWAP_UNSUPPORTED_ERC20_SOURCE/, "Swaps from this token aren't supported yet. Try buying with ETH as the source."],
    [/SWAP_MISSING_DEST_TOKEN/, "Please specify the token contract address you want to buy."],
    [/DELEGATION_NOT_CONFIRMED|DELEGATION_NOT_VISIBLE/, "Smart account setup didn't confirm on-chain. This usually means not enough ETH for gas — top up and try again."],
    [/must be delegated/i, "Your smart account isn't set up yet. Please run AI activation again."],
    [/timeout|TIMEOUT/i, "The request timed out. Please try again."],
];

const GENERIC_MESSAGE = "Something went wrong. Please try again.";

export function sanitizeError(error: unknown): string {
    if (!error) return GENERIC_MESSAGE;

    const raw = error instanceof Error
        ? error.message
        : typeof error === 'string'
            ? error
            : JSON.stringify(error);

    for (const [pattern, friendly] of ERROR_MAP) {
        if (pattern.test(raw)) {
            return friendly;
        }
    }

    return GENERIC_MESSAGE;
}
