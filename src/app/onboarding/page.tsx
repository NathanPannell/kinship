import { requirePageSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { OnboardingScreen } from "@/components/onboarding-screen";

export default async function OnboardingPage() {
  await requirePageSession();
  return <AppShell><OnboardingScreen /></AppShell>;
}
