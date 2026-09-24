import Link from "next/link";
import { ArrowRight, Bot, ContactRound, MessageCircleMore, UserRound } from "lucide-react";
import { PublicShell } from "./public-shell";
import styles from "./public-pages.module.css";

export function PublicHome() {
  return (
    <PublicShell>
      <div className={styles.home}>
        <section className={styles.hero} aria-labelledby="home-title">
          <div className={styles.heroCopy}>
            <h1 id="home-title">Keep the thread with every person you meet.</h1>
            <p>
              Kinship is a small personal networking CRM for the details that make a relationship
              feel remembered. Your notes, follow-up rhythm, and agents all work from the same source
              of truth.
            </p>
            <div className={styles.actions}>
              <Link className={styles.primary} href="/login">Sign in with Google <ArrowRight size={16} aria-hidden="true" /></Link>
              <Link className={styles.secondary} href="/developers">How the API works</Link>
            </div>
            <p className={styles.heroFootnote}>Private by account. Useful with or without an agent.</p>
          </div>

          <aside className={styles.relationshipMap} aria-label="Kinship relationship context shared with you and your agents">
            <div className={styles.mapHeader}>
              <span>Relationship memory</span>
              <span className={styles.accountTag}>Your account</span>
            </div>
            <div className={styles.mapRecord}>
              <h2>One record of the relationship</h2>
              <ul>
                <li><ContactRound size={16} aria-hidden="true" /><span>People and details</span></li>
                <li><MessageCircleMore size={16} aria-hidden="true" /><span>Notes and conversations</span></li>
                <li><ArrowRight size={16} aria-hidden="true" /><span>Follow-up preferences</span></li>
              </ul>
            </div>
            <div className={styles.mapConnector} aria-hidden="true" />
            <div className={styles.connectionActors}>
              <div className={styles.actor}>
                <span className={styles.actorIcon}><UserRound size={17} aria-hidden="true" /></span>
                <span><strong>You</strong><small>keep the context current</small></span>
              </div>
              <div className={styles.actor}>
                <span className={styles.actorIcon}><Bot size={17} aria-hidden="true" /></span>
                <span><strong>Your agent</strong><small>works from the same record</small></span>
              </div>
            </div>
            <p className={styles.mapFootnote}>Your relationships stay yours. Agent access is scoped to your account.</p>
          </aside>
        </section>

        <section className={styles.rhythm} aria-labelledby="rhythm-title">
          <div className={styles.rhythmIntro}>
            <h2 id="rhythm-title">Remember the context. Then keep the connection moving.</h2>
            <p>A little structure makes reaching out feel more natural, whether you manage your network yourself or ask an agent to help.</p>
          </div>
          <ol className={styles.rhythmList}>
            <li>
              <h3>Bring your people together</h3>
              <p>Import a LinkedIn Connections export, or add people as you meet them. Choose who belongs in your personal network.</p>
            </li>
            <li>
              <h3>Keep the useful details</h3>
              <p>Save role, company, notes, and interaction history so the next conversation has somewhere to begin.</p>
            </li>
            <li>
              <h3>Follow up at your pace</h3>
              <p>Set a cadence that fits the relationship. Kinship brings due and upcoming people back into view.</p>
            </li>
          </ol>
        </section>

        <section className={styles.agentSection} aria-labelledby="agent-title">
          <div className={styles.agentCopy}>
            <h2 id="agent-title">Let your agent see the relationship, not just the prompt.</h2>
            <p>With a named API token, an agent can look up who is due, find relationship context, and record changes you ask it to make. Kinship does not send messages to your contacts.</p>
            <Link className={styles.textLink} href="/developers">Read the human-friendly API guide <ArrowRight size={16} aria-hidden="true" /></Link>
          </div>
          <ul className={styles.agentUses}>
            <li><span>Read</span><p>Find follow-ups, search contacts, and review recent interactions.</p></li>
            <li><span>Update</span><p>Create or update a contact, or record an interaction when you direct it.</p></li>
            <li><span>Connect</span><p>Use the public OpenAPI description with Meta Muse or another compatible tool.</p></li>
          </ul>
        </section>
      </div>
    </PublicShell>
  );
}
