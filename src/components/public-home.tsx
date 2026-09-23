import Link from "next/link";
import { ArrowRight, Bot, LockKeyhole, Upload } from "lucide-react";
import { PublicShell } from "./public-shell";
import styles from "./public-pages.module.css";

export function PublicHome() {
  return (
    <PublicShell>
      <section className={styles.hero}>
        <div className={styles.heroCopy}>
          <p className={styles.eyebrow}>Thoughtful follow-up, without the noise</p>
          <h1>Keep the people who matter within reach.</h1>
          <p>Kinship is a private personal CRM for remembering conversations, setting a natural rhythm, and knowing who to reach out to next.</p>
          <div className={styles.actions}>
            <Link className={styles.primary} href="/login">Continue with Google <ArrowRight size={16} aria-hidden="true" /></Link>
            <Link className={styles.secondary} href="/connect/muse">Connect an AI agent</Link>
          </div>
        </div>
        <aside className={styles.promiseCard} aria-label="How Kinship handles your data">
          <h2>Built for your personal network</h2>
          <ul>
            <li><LockKeyhole size={20} aria-hidden="true" /><span>Every account has its own contacts, interactions, and API tokens.</span></li>
            <li><Upload size={20} aria-hidden="true" /><span>Your CSV files are read in your browser. Only the contacts you choose are saved to Kinship.</span></li>
            <li><Bot size={20} aria-hidden="true" /><span>Connect an agent with a named token you can revoke at any time.</span></li>
          </ul>
        </aside>
      </section>
    </PublicShell>
  );
}

