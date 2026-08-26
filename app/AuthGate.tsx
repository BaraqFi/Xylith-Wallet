import { useState } from "react";
import { usePrivy } from "@privy-io/react-auth";
import { SplashScreen } from "@/components/app/SplashScreen";
import { SignInScreen } from "@/components/app/SignInScreen";

export default function AuthGate({ children }: { children: React.ReactNode }) {
  const { ready, authenticated } = usePrivy();
  const [splashDone, setSplashDone] = useState(false);

/*   console.log("user", user); */

  // Wait for PrivyProvider AND splash
  if (!ready || !splashDone) {
    return <SplashScreen onComplete={() => setSplashDone(true)} />;
  }
  if (!authenticated) {
    return <SignInScreen />;
  }
  return <>{children}</>;
}
