import Link from "next/link";
import { HeartHandshake } from "lucide-react";
import type { ReactNode } from "react";
import styles from "./public-shell.module.css";

export function PublicShell({ children }: { children: ReactNode }) {
  return (
    <div className={styles.frame}>
      <header className={styles.header}>
        <Link href="/" className={styles.brand} aria-label="Kinship home">
          <span className={styles.mark} aria-hidden="true">
            <HeartHandshake size={18} strokeWidth={1.8} />
          </span>
          <span>Kinship</span>
        </Link>
        <nav aria-label="Public navigation" className={styles.nav}>
          <Link href="/connect/muse">Muse connector</Link>
          <Link href="/privacy">Privacy</Link>
          <Link href="/login" className={styles.signIn}>Sign in</Link>
        </nav>
      </header>
      <main className={styles.main}>{children}</main>
      <footer className={styles.footer}>
        <div>
          <strong>Kinship</strong>
          <span>A private workspace for staying in touch.</span>
        </div>
        <nav aria-label="Legal">
          <Link href="/privacy">Privacy</Link>
          <Link href="/terms">Terms</Link>
          <Link href="/data-deletion">Data deletion</Link>
        </nav>
      </footer>
    </div>
  );
}

