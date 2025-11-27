import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { SplashScreen } from "@/components/app/SplashScreen";
import { UserPill } from "@privy-io/react-auth/ui";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, authenticated, user } = usePrivy();
  const [splashDone, setSplashDone] = useState(false);

  console.log("user", user);

  // Wait for PrivyProvider AND splash
  if (!ready || !splashDone) {
    return <SplashScreen onComplete={() => setSplashDone(true)} />;
  }
  if (!authenticated) {
    return (
      <div style={{ minHeight: "100vh", display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center" }}>
        <h1 className="text-2xl font-bold mb-4">Sign in to Xylith</h1>
        <UserPill action={{ type: 'login' }} expanded={true} />
      </div>
    );
  }
  return <>{children}</>;
}
