import { requirePageSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { TodayScreen } from "@/components/today-screen";
export default async function HomePage() {
  await requirePageSession();
  return <AppShell><TodayScreen /></AppShell>;
}
