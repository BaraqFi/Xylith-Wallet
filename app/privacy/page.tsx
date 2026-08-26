import type { Metadata } from "next";
import Link from "next/link";
import { site } from "@/lib/site";

export const metadata: Metadata = {
  title: "Privacy Policy — Xylith",
  description: "How Xylith Wallet handles your data.",
};

/* Structure follows the twelve-section privacy-policy framework from the
   ai-legal-claude legal-privacy skill, trimmed to the data this app actually
   touches. Replace the contact address before launch and have counsel review. */

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

export default function PrivacyPage() {
  return (
    <div className="min-h-[100dvh] bg-[color:var(--color-surface)] px-6 py-12">
      <div className="mx-auto max-w-2xl">
        <h1 className="text-3xl font-semibold text-[color:var(--color-depth)]">Privacy Policy</h1>
        <p className="mt-2 text-sm text-[color:var(--color-depth)]/50">
          Last updated: August 26, 2026
        </p>

        <Section title="Who we are">
          <p>
            Xylith is a non-custodial, AI-assisted crypto wallet for EVM chains and
            Solana, operated from {site.url}. This policy explains what we handle
            when you use it — which is deliberately little.
          </p>
        </Section>

        <Section title="What we collect">
          <p>
            <strong>Sign-in details.</strong> Authentication is handled by Privy
            (privy.io). Depending on how you sign in, Privy processes your email
            address or social login identity and manages your embedded wallet.
            We never see or store your password or private keys.
          </p>
          <p>
            <strong>Wallet addresses.</strong> Your public wallet addresses are
            used to fetch balances, prices, and transaction history. Addresses and
            on-chain activity are public by the nature of blockchains.
          </p>
          <p>
            <strong>AI commands.</strong> When you use AI mode, the text of your
            command (and, for summaries, recent transaction data) is sent to
            Google&apos;s Gemini API to be interpreted. AI sessions use a
            temporary, spend-limited session key that is encrypted on our servers
            and deleted when you revoke access.
          </p>
          <p>
            <strong>Device storage.</strong> Balances and token lists are cached in
            your browser&apos;s local storage for speed. They stay on your device.
          </p>
          <p>
            We do not run analytics or advertising trackers, and we do not sell
            personal information.
          </p>
        </Section>

        <Section title="How we use it">
          <p>
            Solely to operate the wallet: authenticating you (contract), showing
            balances and history, executing the transactions you approve, and
            enforcing the AI spending limits you configure (legitimate interest in
            protecting your funds).
          </p>
        </Section>

        <Section title="Who we share it with">
          <p>
            Service providers that make the wallet work, each bound by their own
            terms: Privy (authentication and embedded wallets), Alchemy and other
            RPC providers (blockchain access), Moralis (token data), 1inch and
            Jupiter (swap routing), and Google (AI command parsing). We share only
            what each needs — typically a public address or the command text.
            We may disclose information if the law requires it.
          </p>
        </Section>

        <Section title="Retention">
          <p>
            AI session data expires automatically within 24 hours or when you
            revoke it. Account data lives with Privy for as long as your account
            exists. Local caches persist until you clear your browser data.
          </p>
        </Section>

        <Section title="Security">
          <p>
            Private keys never touch our servers. AI session keys are encrypted
            with AES-256-GCM, all traffic uses TLS, and AI spending is capped
            on-chain by limits you set. No system is perfectly secure; use a
            strong sign-in method.
          </p>
        </Section>

        <Section title="Your rights">
          <p>
            If you are in the EEA or UK (GDPR) you can request access,
            correction, deletion, portability, or restriction of your personal
            data, and complain to your supervisory authority. If you are a
            California resident (CCPA/CPRA) you have equivalent rights to know,
            delete, and correct — and we do not sell or share personal
            information as those terms are defined there. Exercise any of these
            via the contact below; deleting your Privy account removes the
            personal data we can control. Note we cannot alter public
            blockchains.
          </p>
        </Section>

        <Section title="Children">
          <p>
            Xylith is not directed at children under 18 and we do not knowingly
            collect their data.
          </p>
        </Section>

        <Section title="International transfers">
          <p>
            Our providers may process data in the United States and elsewhere,
            under their own safeguards such as standard contractual clauses.
          </p>
        </Section>

        <Section title="Changes & contact">
          <p>
            We will update this page when our practices change and revise the date
            above. Questions or requests: {CONTACT_EMAIL}.
          </p>
        </Section>

        <p className="mt-10 text-xs text-[color:var(--color-depth)]/40">
          This policy is provided for transparency and does not constitute legal
          advice.
        </p>

        <div className="mt-8 flex gap-4 text-sm">
          <Link href="/" className="text-[color:var(--color-accent)] hover:underline">
            Back to Xylith
          </Link>
          <Link href="/terms" className="text-[color:var(--color-accent)] hover:underline">
            Terms of Service
          </Link>
        </div>
      </div>
    </div>
  );
}
