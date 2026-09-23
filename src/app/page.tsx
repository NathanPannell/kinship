import { requirePageSession } from "@/lib/auth";
import { hasContacts } from "@/lib/data";
import { AppShell } from "@/components/app-shell";
import { TodayScreen } from "@/components/today-screen";
import { redirect } from "next/navigation";
export default async function HomePage() {
  await requirePageSession();
  if (!(await hasContacts())) redirect("/onboarding");
  return <AppShell><TodayScreen /></AppShell>;
}
