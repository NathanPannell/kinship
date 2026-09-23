import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import styles from "@/components/public-pages.module.css";

export const metadata: Metadata = { title: "Connect Meta Muse · Kinship", description: "Connect Meta Muse to your Kinship account with a scoped, revocable API token." };

export default function MuseConnectorPage() {
  return <PublicShell><article className={styles.article}>
    <p className={styles.eyebrow}>Meta Muse custom connector</p>
    <h1>Give Muse a clear, revocable way into Kinship.</h1>
    <p className={styles.lede}>Kinship exposes a public OpenAPI 3.1 description and a per-account bearer token so Muse can build a custom connector.</p>

    <section><h2>Set up the connector</h2>
      <ol className={styles.steps}>
        <li><Link href="/login">Sign in to Kinship</Link>, open API, and create a named token such as “Meta Muse.” Copy it when it appears because Kinship will not show the secret again.</li>
        <li>In Muse, ask it to create a custom connector from your Kinship API. Give it this site&apos;s <Link href="/openapi.json">OpenAPI JSON</Link> URL as the API reference.</li>
        <li>Provide the named token as an <code>Authorization: Bearer</code> credential when configuring requests. Meta says Muse stores connector credentials in its secure credential store.</li>
        <li>Test with <code>GET /api/agent/suggestions</code>. Review write actions before allowing Muse to create contacts, update contacts, or record interactions.</li>
      </ol>
    </section>

    <section><h2>What Muse can do</h2>
      <ul>
        <li>List and search the contacts in the Kinship account that created the token.</li>
        <li>Read one contact and recent interaction history.</li>
        <li>See who is due for follow-up.</li>
        <li>Create or update a contact and record an interaction when you direct it to.</li>
      </ul>
      <p>Kinship&apos;s API does not send email, LinkedIn messages, WhatsApp messages, or other communications.</p>
    </section>

    <section><h2>Access boundaries</h2><p>Each token belongs to one Kinship account and cannot read another account&apos;s records. Revoke the token from Kinship&apos;s API page to stop future API access. Also delete the saved credential or connector in Muse if you no longer want Muse to retain it.</p></section>
    <section><h2>Privacy</h2><p>Meta does not review custom connectors or their handling of information. Only connect services you trust, and share the minimum data needed for a task. Read Kinship&apos;s <Link href="/privacy">privacy policy</Link> and Meta&apos;s terms before connecting.</p></section>
  </article></PublicShell>;
}
