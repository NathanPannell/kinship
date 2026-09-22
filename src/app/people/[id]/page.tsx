import { requirePageSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { PersonScreen } from "@/components/person-screen";
export default async function PersonPage({ params }: { params: Promise<{ id: string }> }) {
  await requirePageSession();
  const { id } = await params;
  return <AppShell><PersonScreen id={id} /></AppShell>;
}
