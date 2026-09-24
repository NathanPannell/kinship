import { redirect } from "next/navigation";
import { requirePageUserId } from "@/lib/auth";
import { query } from "@/lib/db";
import { WelcomeGuide } from "@/components/welcome-guide";

export default async function WelcomePage() {
  const userId = await requirePageUserId();
  const [account] = await query<{ welcome_completed_at: string | null; has_contacts: boolean; name: string }>(
    `SELECT name, welcome_completed_at,
            EXISTS (SELECT 1 FROM contacts WHERE owner_user_id = users.id) AS has_contacts
     FROM users WHERE id = $1`,
    [userId],
  );
  if (!account || account.has_contacts || account.welcome_completed_at) redirect("/");
  return <WelcomeGuide name={account.name} />;
}
