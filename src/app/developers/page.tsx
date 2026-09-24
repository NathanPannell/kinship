import type { Metadata } from "next";
import Link from "next/link";
import { ArrowRight, ArrowUpRight, KeyRound, ShieldCheck } from "lucide-react";
import { PublicShell } from "@/components/public-shell";
import styles from "@/components/public-pages.module.css";

export const metadata: Metadata = {
  title: "Developers · Kinship",
  description: "A plain-language guide to Kinship's account-scoped agent API, token setup, and supported actions.",
};

export default function DevelopersPage() {
  return (
    <PublicShell>
      <div className={styles.developers}>
        <section className={styles.apiHero} aria-labelledby="developers-title">
          <div>
            <h1 id="developers-title">One relationship record your agent can actually use.</h1>
            <p className={styles.apiLede}>
              Kinship&apos;s API gives your chosen tools a structured view of your professional
              relationships, follow-up plans, and interaction history. You and your agent work from
              the same account data, so useful context does not get lost between conversations.
            </p>
            <div className={styles.apiActions}>
              <Link className={styles.primary} href="/login">Sign in to manage API access <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link className={styles.secondary} href="/openapi.json">OpenAPI specification <ArrowUpRight size={15} aria-hidden="true" /></Link>
            </div>
          </div>
          <aside className={styles.apiGuardrail} aria-label="API access boundaries">
            <div className={styles.guardrailTitle}>
              <span className={styles.guardrailIcon}><ShieldCheck size={20} aria-hidden="true" /></span>
              <h2>Access stays in your hands.</h2>
            </div>
            <p>Every request needs a named bearer token created from your Kinship account. The token can access only that account, and you can revoke it from the API page.</p>
            <p className={styles.guardrailBoundary}>The API reads and updates relationship records. It does not send messages or delete contacts.</p>
          </aside>
        </section>

        <section className={styles.apiSetup} aria-labelledby="setup-title">
          <h2 id="setup-title">Connect an agent in three steps.</h2>
          <ol className={styles.setupSteps}>
            <li>
              <span className={styles.stepIndex}>1</span>
              <h3>Create a token</h3>
              <p><Link href="/login">Sign in</Link>, open API, and create a named token for the tool you are connecting. Copy the secret when it appears; Kinship shows it once.</p>
            </li>
            <li>
              <span className={styles.stepIndex}>2</span>
              <h3>Share the API details</h3>
              <p>Give the agent your Kinship base URL, the token as a bearer credential, and the <Link href="/openapi.json">OpenAPI specification</Link> so it can understand the available requests.</p>
            </li>
            <li>
              <span className={styles.stepIndex}>3</span>
              <h3>Choose how it helps</h3>
              <p>Start with suggestions or search. Review any action that creates or changes a relationship record.</p>
            </li>
          </ol>
        </section>

        <section className={styles.apiCapabilities} aria-labelledby="capabilities-title">
          <div className={styles.capabilityHeader}>
            <h2 id="capabilities-title">What an agent can do with your Kinship data</h2>
            <p>Read actions find context. Write actions save changes to your account, so give your tool the access that fits the task.</p>
          </div>
          <div className={styles.capabilityGroups}>
            <div className={styles.capabilityGroup}>
              <h3>Read relationship context</h3>
              <ul className={styles.apiActionList}>
                <li>
                  <span className={styles.method}>GET</span>
                  <div><code>/api/agent/suggestions</code><p>Get up to three contacts due today, along with upcoming follow-ups.</p></div>
                </li>
                <li>
                  <span className={styles.method}>GET</span>
                  <div><code>/api/agent/contacts</code><p>Search by name, company, or role. Filter by priority, overdue status, or follow-up date.</p></div>
                </li>
                <li>
                  <span className={styles.method}>GET</span>
                  <div><code>/api/agent/contacts/&#123;id&#125;</code><p>Read one contact and their recent interaction history.</p></div>
                </li>
              </ul>
            </div>
            <div className={styles.capabilityGroup}>
              <h3>Save relationship updates</h3>
              <ul className={styles.apiActionList}>
                <li>
                  <span className={`${styles.method} ${styles.writeMethod}`}>POST</span>
                  <div><code>/api/agent/contacts</code><p>Create a contact. A name is required; follow-up cadence and other details are optional.</p></div>
                </li>
                <li>
                  <span className={`${styles.method} ${styles.writeMethod}`}>PATCH</span>
                  <div><code>/api/agent/contacts/&#123;id&#125;</code><p>Update a contact&apos;s details or follow-up preferences.</p></div>
                </li>
                <li>
                  <span className={`${styles.method} ${styles.writeMethod}`}>POST</span>
                  <div><code>/api/agent/interactions</code><p>Record a conversation or touchpoint and refresh the contact&apos;s last-contact date.</p></div>
                </li>
              </ul>
            </div>
          </div>
        </section>

        <section className={styles.requestSection} aria-labelledby="request-title">
          <div className={styles.requestCopy}>
            <h2 id="request-title">A request looks like this.</h2>
            <p>Replace <code>KINSHIP_URL</code> with the address you use to sign in. Send the bearer token with every request. The token is a secret, so share it only with a tool you trust.</p>
          </div>
          <pre className={styles.requestExample} tabIndex={0}><code>{`GET {KINSHIP_URL}/api/agent/suggestions
Authorization: Bearer YOUR_NAMED_TOKEN
Accept: application/json`}</code></pre>
        </section>

        <section className={styles.apiNext} aria-labelledby="next-title">
          <div>
            <h2 id="next-title">Ready to connect your own tool?</h2>
          </div>
          <div className={styles.apiNextLinks}>
            <Link className={styles.primary} href="/api-docs"><KeyRound size={15} aria-hidden="true" /> Manage tokens and try requests</Link>
            <Link className={styles.secondary} href="/connect/muse">Meta Muse setup guide</Link>
          </div>
        </section>
      </div>
    </PublicShell>
  );
}
