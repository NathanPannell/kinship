import { requirePageSession } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { PeopleScreen } from "@/components/people-screen";
export default async function PeoplePage() {
  await requirePageSession();
  return <AppShell><PeopleScreen /></AppShell>;
}
