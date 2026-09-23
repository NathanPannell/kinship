import { getPageUserId } from "@/lib/auth";
import { hasContacts } from "@/lib/data";
import { AppShell } from "@/components/app-shell";
import { TodayScreen } from "@/components/today-screen";
import { PublicHome } from "@/components/public-home";
import { redirect } from "next/navigation";
export default async function HomePage() {
  const userId = await getPageUserId();
  if (!userId) return <PublicHome />;
  if (!(await hasContacts(userId))) redirect("/onboarding");
  return <AppShell><TodayScreen /></AppShell>;
}
