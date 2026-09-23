import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import styles from "@/components/public-pages.module.css";

export const metadata: Metadata = { title: "Privacy · Kinship", description: "How Kinship collects, uses, stores, and deletes your data." };

export default function PrivacyPage() {
  return <PublicShell><article className={styles.article}>
    <p className={styles.eyebrow}>Privacy</p>
    <h1>Your network is personal.</h1>
    <p className={styles.lede}>Kinship uses your information to provide a private relationship workspace and the integrations you choose to enable.</p>
    <p className={styles.updated}>Effective September 23, 2026</p>

    <section><h2>Information Kinship collects</h2>
      <ul>
        <li><strong>Google sign-in data:</strong> your Google account identifier, email address, name, and profile picture. Kinship requests only the <code>openid</code>, <code>email</code>, and <code>profile</code> scopes.</li>
        <li><strong>Relationship data:</strong> contacts, profile details, notes, priorities, follow-up cadence, interaction history, and photos you save.</li>
        <li><strong>Import data:</strong> In guided onboarding, CSV files are parsed in your browser for preview and selection. Only the contact records and message-derived dates you select are sent to Kinship and stored in your account&apos;s cloud database. The older import API accepts a Connections CSV upload for server-side processing if you choose to call it directly.</li>
        <li><strong>API access:</strong> names and metadata for the API tokens you create. Token secrets are stored only as cryptographic hashes after they are shown to you once.</li>
      </ul>
    </section>

    <section><h2>How the information is used</h2>
      <p>Kinship uses this information to authenticate you, keep each account separate, show relationship reminders, record interactions, import selected contacts, and answer requests made with your account&apos;s API tokens. Kinship does not use Google profile data for advertising and does not sell personal information.</p>
      <p>Kinship&apos;s use and transfer of information received from Google APIs follows the Google API Services User Data Policy, including its Limited Use requirements.</p>
    </section>

    <section><h2>AI agents and API tokens</h2>
      <p>If you give a Kinship API token to Meta Muse or another agent, that agent can read or change the Kinship data allowed by the documented API. Kinship does not send messages to your contacts. You choose which agent receives a token and can revoke that token from the API page. The third party&apos;s own terms and privacy practices also apply to information you send through it.</p>
    </section>

    <section><h2>Storage and service providers</h2>
      <p>Kinship stores account and CRM data in Neon Postgres and runs the web application on Vercel. These service providers process data to operate the app. Data is transmitted over HTTPS. Each account&apos;s records and API tokens are scoped to that account.</p>
    </section>

    <section><h2>Retention and deletion</h2>
      <p>Kinship keeps your account data until you delete it or your account. Revoked API tokens remain as audit metadata but cannot be used. See <Link href="/data-deletion">Data deletion</Link> for the controls and what deletion covers.</p>
    </section>

    <section><h2>Your choices</h2>
      <p>You can choose which contacts to import, edit or delete contact information, revoke API tokens, disconnect third-party agents, and delete your Kinship account. You can also revoke Kinship&apos;s Google access from your Google Account settings.</p>
    </section>
  </article></PublicShell>;
}
