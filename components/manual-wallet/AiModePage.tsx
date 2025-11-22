"use client";

export function AiModePage() {

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-6 py-12">
      <div className="wallet-card p-12 text-center">
        <div className="mb-6 flex justify-center">
          <div className="flex h-20 w-20 items-center justify-center rounded-full bg-[color:var(--color-accent)]/15">
            <svg
              viewBox="0 0 24 24"
              className="h-10 w-10 text-[color:var(--color-accent)]"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
            >
              <path
                d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
        </div>
        <h2 className="mb-3 text-2xl font-semibold text-[color:var(--color-depth)]">
          AI Mode Coming Soon
        </h2>
        <p className="mb-6 text-[color:var(--color-depth)]/70">
          AI Mode will allow you to execute on-chain transactions through natural language
          commands. Chat with the AI agent to send tokens, swap assets, and perform trades
          across EVM and Solana networks.
        </p>
        <div className="space-y-3 text-left">
          <div className="flex items-start gap-3 rounded-2xl border border-[color:var(--color-depth)]/10 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
                <path
                  d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold">Chat-Based Commands</p>
              <p className="text-sm text-[color:var(--color-depth)]/60">
                Use simple commands like &quot;/send 10 USDC to 0x...&quot; or &quot;/swap $50 ETH to SOL&quot;
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-[color:var(--color-depth)]/10 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
                <path
                  d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold">Secure Session Control</p>
              <p className="text-sm text-[color:var(--color-depth)]/60">
                AI actions use secure session keys that you can revoke at any time
              </p>
            </div>
          </div>
          <div className="flex items-start gap-3 rounded-2xl border border-[color:var(--color-depth)]/10 p-4">
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-[color:var(--color-accent)]/10 text-[color:var(--color-accent)]">
              <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor">
                <path
                  d="M8 7h12M8 12h12M8 17h12M3 7h.01M3 12h.01M3 17h.01"
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth="2"
                />
              </svg>
            </div>
            <div>
              <p className="font-semibold">Multi-Chain Support</p>
              <p className="text-sm text-[color:var(--color-depth)]/60">
                Works across EVM chains and Solana with cross-chain swap capabilities
              </p>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

