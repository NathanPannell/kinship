import { requirePageUserId } from "@/lib/auth";
import { AppShell } from "@/components/app-shell";
import { DeleteAccount } from "./delete-account";
import Link from "next/link";
import { ArrowUpRight, BookOpen, FileUp, LogOut, ShieldCheck, Trash2 } from "lucide-react";

export default async function SettingsPage() {
  await requirePageUserId();
  return <AppShell><div className="settings-page">
    <header className="settings-header">
      <div><h1 className="page-title">Settings</h1><p className="page-subtitle">Your space, your data, your connections.</p></div>
      <span className="settings-privacy"><ShieldCheck size={16} aria-hidden="true" /> Private to your account</span>
    </header>

    <div className="settings-grid">
      <div className="settings-main">
        <section className="settings-panel" aria-labelledby="import-settings-heading">
          <div className="settings-panel-heading"><span className="settings-panel-icon settings-panel-icon-accent"><FileUp size={20} aria-hidden="true" /></span><div><h2 id="import-settings-heading">Bring in your network</h2><p>Import from LinkedIn whenever your connections or messages change.</p></div></div>
          <div className="settings-action-row"><span>Choose exactly who to track, then set each person&apos;s rhythm.</span><Link className="button button-secondary" href="/onboarding">Open importer <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
        </section>

        <section className="settings-panel" aria-labelledby="agent-settings-heading">
          <div className="settings-panel-heading"><span className="settings-panel-icon"><BookOpen size={20} aria-hidden="true" /></span><div><h2 id="agent-settings-heading">Agent access</h2><p>Your API tokens let an agent work with this account&apos;s contacts.</p></div></div>
          <div className="settings-action-row"><span>Create, inspect, and revoke tokens from the API workspace.</span><Link className="button button-secondary" href="/api-docs">Manage API tokens <ArrowUpRight size={15} aria-hidden="true" /></Link></div>
          <Link className="settings-text-link" href="/developers">Read the public API guide <ArrowUpRight size={14} aria-hidden="true" /></Link>
        </section>
      </div>

      <aside className="settings-side" aria-label="Account controls">
        <section className="settings-panel settings-account" aria-labelledby="account-settings-heading">
          <h2 id="account-settings-heading">Your account</h2>
          <p>Signed in with Google. Your relationships belong to this workspace.</p>
          <form action="/api/auth/logout" method="post"><button className="button button-secondary settings-signout" type="submit"><LogOut size={16} aria-hidden="true" /> Sign out</button></form>
        </section>
        <section className="settings-panel settings-danger" aria-labelledby="data-settings-heading">
          <h2 id="data-settings-heading"><Trash2 size={17} aria-hidden="true" /> Delete your data</h2>
          <p>Deleting your account removes its contacts, interactions, uploaded photos, and API tokens from Kinship&apos;s active database. Provider backups may retain copies until they expire.</p>
          <details><summary>Delete account and data</summary><DeleteAccount /></details>
        </section>
      </aside>
    </div>
  </div></AppShell>;
}
