import { getPageUserId } from "@/lib/auth";
import { query } from "@/lib/db";
import { AppShell } from "@/components/app-shell";
import { TodayScreen } from "@/components/today-screen";
import { PublicHome } from "@/components/public-home";
import { redirect } from "next/navigation";
export default async function HomePage() {
  const userId = await getPageUserId();
  if (!userId) return <PublicHome />;
  const [account] = await query<{ welcome_completed_at: string | null; has_contacts: boolean }>(
    `SELECT welcome_completed_at,
            EXISTS (SELECT 1 FROM contacts WHERE owner_user_id = users.id) AS has_contacts
     FROM users WHERE id = $1`,
    [userId],
  );
  if (account && !account.has_contacts && !account.welcome_completed_at) redirect("/welcome");
  return <AppShell><TodayScreen hasContacts={Boolean(account?.has_contacts)} /></AppShell>;
}
