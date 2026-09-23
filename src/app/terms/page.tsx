import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";
import styles from "@/components/public-pages.module.css";

export const metadata: Metadata = { title: "Terms · Kinship", description: "Terms for using Kinship." };

export default function TermsPage() {
  return <PublicShell><article className={styles.article}>
    <p className={styles.eyebrow}>Terms</p>
    <h1>Use Kinship with care.</h1>
    <p className={styles.lede}>These terms govern your use of Kinship and its agent API.</p>
    <p className={styles.updated}>Effective September 23, 2026</p>

    <section><h2>Your account</h2><p>You are responsible for activity under your Google sign-in and for keeping API tokens confidential. Revoke a token promptly if it is shared with the wrong person or service.</p></section>
    <section><h2>Your data</h2><p>You keep ownership of the contact and interaction information you add. You give Kinship permission to process it only as needed to provide and secure the service. You must have the right to upload and use the information you add.</p></section>
    <section><h2>Acceptable use</h2><p>Do not use Kinship to break the law, invade another person&apos;s privacy, send spam, gain unauthorized access, disrupt the service, or distribute malicious code. Respect the terms of LinkedIn, Meta Muse, Google, and any other service you connect.</p></section>
    <section><h2>Agents and integrations</h2><p>Third-party agents act with the API token you give them. Review an agent&apos;s actions before allowing writes. Kinship documents whether an endpoint reads or changes data and does not send messages to contacts. Third-party services are governed by their own terms.</p></section>
    <section><h2>Service availability</h2><p>Kinship is provided as available and may change while it develops. Keep copies of important information. To the extent allowed by law, Kinship is not liable for indirect, incidental, or consequential losses arising from use of the service.</p></section>
    <section><h2>Ending use</h2><p>You may stop using Kinship and delete your account at any time. Kinship may suspend access used unlawfully or in a way that threatens the service or other people. Read the <Link href="/data-deletion">data deletion guide</Link> for details.</p></section>
  </article></PublicShell>;
}
