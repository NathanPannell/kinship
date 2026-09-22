import { requirePageSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { ImportScreen } from "@/components/import-screen";
export default async function ImportPage() {
  await requirePageSession();
  return <AppShell><ImportScreen /></AppShell>;
}
