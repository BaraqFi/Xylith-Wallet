import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "Terms of Service — Xylith",
  description: "The terms that govern your use of Xylith Wallet.",
};

/* Structure follows the ai-legal-claude legal-terms framework, trimmed to the
   clauses that apply to a non-custodial wallet (no payments to us, no
   user-generated content, no public API). Replace the contact address before
   launch and have counsel review. */

const CONTACT_EMAIL = "support@xylith.app"; // FILL IN: real support address

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-8">
      <h2 className="text-lg font-semibold text-[color:var(--color-depth)]">{title}</h2>
      <div className="mt-2 space-y-2 text-sm leading-relaxed text-[color:var(--color-depth)]/70">
        {children}
      </div>
    </section>
  );
}

export default function TermsPage() {
  return (
    <div className="min-h-[100dvh] bg-[color:var(--color-surface)] px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold text-[color:var(--color-depth)]">
          Terms of Service
        </h1>
        <p className="mt-2 text-sm text-[color:var(--color-depth)]/50">
          Last updated: August 26, 2026
        </p>

        <Section title="1. Acceptance">
          <p>
            By using Xylith you agree to these terms. If you don&apos;t agree,
            don&apos;t use the app.
          </p>
        </Section>

        <Section title="2. What Xylith is">
          <p>
            Xylith is a non-custodial software interface for managing crypto
            assets on EVM chains and Solana, with an optional AI assistant that
            prepares transactions from plain-English commands. We never hold your
            funds or your private keys, and we cannot recover, reverse, or freeze
            transactions.
          </p>
        </Section>

        <Section title="3. Your responsibilities">
          <p>
            You are responsible for your sign-in method, your device, and every
            transaction you approve. Blockchain transactions are irreversible —
            verify addresses and amounts before confirming. You must be at least
            18 and legally able to use crypto services where you live.
          </p>
        </Section>

        <Section title="4. AI mode">
          <p>
            The AI assistant acts only within the session and spending limits you
            configure, and transactions require your confirmation. AI output can
            be wrong: it is not financial, investment, or legal advice, and you
            are responsible for reviewing everything before it executes. You can
            revoke the AI&apos;s access at any time.
          </p>
        </Section>

        <Section title="5. Risks">
          <p>
            Crypto assets are volatile and can lose all value. Smart contracts,
            bridges, and third-party protocols can fail or be exploited. Prices
            and routes shown in the app come from third parties and may be
            inaccurate or stale. You use Xylith at your own risk.
          </p>
        </Section>

        <Section title="6. Prohibited use">
          <p>
            Don&apos;t use Xylith for anything unlawful — including money
            laundering, sanctions evasion, or fraud — and don&apos;t attempt to
            attack, overload, or reverse-engineer the service.
          </p>
        </Section>

        <Section title="7. Third-party services">
          <p>
            Xylith relies on third parties (Privy, Alchemy, 1inch, Jupiter,
            Google, and others) that have their own terms and may change or fail
            independently of us. We are not responsible for their services or for
            the tokens and protocols you interact with.
          </p>
        </Section>

        <Section title="8. Intellectual property">
          <p>
            Xylith&apos;s software, branding, and content belong to us or our
            licensors. We grant you a limited, revocable licence to use the app
            for its intended purpose.
          </p>
        </Section>

        <Section title="9. Disclaimers & liability">
          <p>
            Xylith is provided &quot;as is&quot; and &quot;as available&quot;,
            without warranties of any kind. To the maximum extent the law allows,
            we are not liable for lost funds, lost profits, or any indirect or
            consequential damages arising from your use of the app — including
            losses caused by your transactions, third-party failures, or AI
            mistakes.
          </p>
        </Section>

        <Section title="10. Termination">
          <p>
            You can stop using Xylith at any time; your assets remain yours,
            controlled by your keys. We may suspend the service or your access to
            it where these terms are violated or the law requires.
          </p>
        </Section>

        <Section title="11. Changes">
          <p>
            We may update these terms as the product evolves; the date above
            reflects the current version. Continued use after changes means
            acceptance.
          </p>
        </Section>

        <Section title="12. Contact">
          <p>Questions about these terms: {CONTACT_EMAIL}.</p>
        </Section>

        <p className="mt-10 text-xs text-[color:var(--color-depth)]/40">
          These terms are a plain-language template and do not constitute legal
          advice.
        </p>

        <div className="mt-8 flex gap-4 text-sm">
          <Link href="/" className="text-[color:var(--color-accent)] hover:underline">
            Back to Xylith
          </Link>
          <Link href="/privacy" className="text-[color:var(--color-accent)] hover:underline">
            Privacy Policy
          </Link>
        </div>
      </div>
    </div>
  );
}
