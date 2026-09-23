import { requirePageSession } from "@/lib/auth";
import { redirect } from "next/navigation";
export default async function ImportPage() {
  await requirePageSession();
  redirect("/onboarding");
}
