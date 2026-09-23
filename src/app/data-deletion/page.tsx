import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import styles from "@/components/public-pages.module.css";

export const metadata: Metadata = { title: "Data deletion · Kinship", description: "How to delete contact data or your Kinship account." };

export default function DataDeletionPage() {
  return <PublicShell><article className={styles.article}>
    <p className={styles.eyebrow}>Data deletion</p>
    <h1>You control what Kinship keeps.</h1>
    <p className={styles.lede}>Delete individual records, clear your contact list, or remove your account and its data from Kinship&apos;s active database.</p>

    <section><h2>Delete contact data</h2>
      <ol className={styles.steps}>
        <li><Link href="/login">Sign in to Kinship</Link> with the Google account that owns the data.</li>
        <li>Open People. Select individual contacts and choose Delete selected, or use Delete everyone to clear the contact list.</li>
        <li>Confirm the deletion. Related interaction history and saved contact photos are removed with each contact.</li>
      </ol>
    </section>

    <section><h2>Delete your account</h2>
      <ol className={styles.steps}>
        <li>Sign in and open the account controls.</li>
        <li>Choose Delete account and review the confirmation.</li>
        <li>Confirm to remove the account, contacts, interactions, contact photos, and API tokens from Kinship&apos;s active database.</li>
      </ol>
      <div className={styles.callout}><p>Account deletion cannot be undone in Kinship. Service-provider backups or logs may retain copies until their retention periods expire. Revoke any connected agent access before deleting if you also want to remove the saved credential from that third-party service.</p></div>
    </section>

    <section><h2>Google connection</h2><p>Deleting your Kinship account removes Kinship&apos;s stored copy of your Google sign-in profile. You can separately remove Kinship from the third-party access section of your Google Account.</p></section>
  </article></PublicShell>;
}
