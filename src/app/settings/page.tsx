import { requirePageUserId } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { DeleteAccount } from "./delete-account";

export default async function SettingsPage() {
  await requirePageUserId();
  return <AppShell><div className="mx-auto max-w-3xl px-5 py-10 text-[#17251d]">
    <h1 className="text-3xl font-semibold">Settings</h1>
    <p className="mt-2 text-sm text-[#607167]">Manage your Kinship account and data.</p>
    <section className="mt-8 rounded-xl border border-[#dfe5dc] bg-white p-6">
      <h2 className="text-lg font-semibold">Your data</h2>
      <p className="mt-2 text-sm text-[#607167]">Deleting your account permanently removes your contacts, interactions, uploaded photos, and API tokens.</p>
      <DeleteAccount />
    </section>
  </div></AppShell>;
}
