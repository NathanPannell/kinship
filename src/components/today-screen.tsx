"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { apiRequest, formatDate, priorityClass, relativeContactDate } from "./crm-utils";
import type { Suggestion } from "./crm-types";
import { PersonAvatar } from "./person-avatar";
import { ArrowUpRight, CalendarDays, Check, Clock3, Link2, Mail, MessageCircle, Plus, RefreshCw, Sparkles } from "./icons";
import { InteractionForm } from "./interaction-form";

type SuggestionsResponse = { suggestions?: Suggestion[]; upcoming?: Suggestion[] };

function phoneLink(phone?: string | null) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits ? `https://wa.me/${digits}` : "";
}

function LinkAction({ href, label, icon: Icon, disabled }: { href: string; label: string; icon: typeof Link2; disabled?: boolean }) {
  if (disabled) return <span className="link-action" aria-disabled="true"><Icon size={14} aria-hidden="true" />{label}</span>;
  return <a className="link-action" href={href} target="_blank" rel="noreferrer" aria-label={`${label} for this person`}><Icon size={14} aria-hidden="true" />{label}<ArrowUpRight size={12} aria-hidden="true" /></a>;
}

function SuggestionCard({ suggestion, onRefresh }: { suggestion: Suggestion; onRefresh: () => Promise<void> }) {
  const [activeForm, setActiveForm] = useState<"contacted" | "interaction" | null>(null);
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const [snoozing, setSnoozing] = useState(false);
  const [message, setMessage] = useState("");
  const roleLine = [suggestion.role, suggestion.company].filter(Boolean).join(" at ") || "Professional connection";
  const lastNote = suggestion.latest_interaction?.note;

  const logInteraction = async (values: { channel: string; note: string; occurred_at?: string }) => {
    await apiRequest("/api/interactions", {
      method: "POST",
      body: JSON.stringify({ contact_id: suggestion.id, ...values }),
    });
    setActiveForm(null);
    await onRefresh();
  };

  const snooze = async (days: number) => {
    setSnoozing(true);
    setMessage("");
    try {
      await apiRequest("/api/snoozes", { method: "POST", body: JSON.stringify({ contact_id: suggestion.id, days }) });
      setSnoozeOpen(false);
      setMessage(`Snoozed for ${days} days.`);
      await onRefresh();
    } catch (error) {
      setMessage(error instanceof Error ? error.message : "Could not snooze this person.");
    } finally {
      setSnoozing(false);
    }
  };

  return (
    <article className="suggestion-card">
      <div className="suggestion-main">
        <div className="person-heading">
          <PersonAvatar contactId={suggestion.id} className="person-avatar" name={suggestion.name} photoUrl={suggestion.photo_url} uploadedPhotoUpdatedAt={suggestion.uploaded_photo_updated_at} />
          <div className="person-heading-copy">
            <Link className="person-name" href={`/people/${suggestion.id}`}>{suggestion.name}</Link>
            <div className="person-role">{roleLine}</div>
            <span className={priorityClass(suggestion.priority)}>{suggestion.priority}</span>
          </div>
        </div>

        <div className="suggestion-reason">
          <span className="meta-label">Why today</span>
          <p>{suggestion.reason || (suggestion.days_since_contact === null ? "A new connection worth getting to know." : "Their next touchpoint is here.")}</p>
        </div>

        <div className="suggestion-meta">
          <div className="meta-item">
            <span className="meta-label">Last contact</span>
            <span className="meta-value">{suggestion.last_contacted_at ? relativeContactDate(suggestion.last_contacted_at) : "Never"}</span>
          </div>
          <div className="meta-item">
            <span className="meta-label">Target cadence</span>
            <span className="meta-value">Every {suggestion.cadence_days} days</span>
          </div>
        </div>
      </div>

      {lastNote ? <div className="suggestion-note"><Sparkles size={14} aria-hidden="true" /><span>{lastNote}</span></div> : null}

      <div className="suggestion-actions">
        <div className="link-actions">
          <LinkAction href={suggestion.linkedin_url ?? "#"} label="LinkedIn" icon={Link2} disabled={!suggestion.linkedin_url} />
          <LinkAction href={phoneLink(suggestion.phone)} label="WhatsApp" icon={MessageCircle} disabled={!suggestion.phone} />
          <LinkAction href={suggestion.email ? `mailto:${suggestion.email}` : "#"} label="Email" icon={Mail} disabled={!suggestion.email} />
        </div>
        <div className="contact-actions">
          <button className="button button-accent" type="button" onClick={() => setActiveForm("contacted")}><Check size={15} aria-hidden="true" />Contacted</button>
          <button className="button button-secondary" type="button" onClick={() => setActiveForm("interaction")}><Plus size={15} aria-hidden="true" />Add note</button>
          <div style={{ position: "relative" }}>
            <button className="button button-quiet" type="button" onClick={() => setSnoozeOpen((open) => !open)} aria-expanded={snoozeOpen}><Clock3 size={15} aria-hidden="true" />Snooze</button>
            {snoozeOpen ? <div className="snooze-menu" aria-label="Snooze duration">
              {[7, 14, 30].map((days) => <button key={days} type="button" onClick={() => void snooze(days)} disabled={snoozing}>For {days} days</button>)}
            </div> : null}
          </div>
        </div>
      </div>

      {message ? <p className="inline-error" role="alert" style={{ margin: "10px 20px" }}>{message}</p> : null}
      {activeForm ? <div className="quick-form">
        <div className="quick-form-head"><strong>{activeForm === "contacted" ? "Log today’s touchpoint" : "Add an interaction"}</strong><button className="icon-button" type="button" onClick={() => setActiveForm(null)} aria-label="Close interaction form">×</button></div>
        <InteractionForm compact onCancel={() => setActiveForm(null)} onSubmit={logInteraction} />
      </div> : null}
    </article>
  );
}

export function TodayScreen({ hasContacts = true }: { hasContacts?: boolean }) {
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);
  const [upcoming, setUpcoming] = useState<Suggestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState("");

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await apiRequest<SuggestionsResponse>("/api/suggestions");
      setSuggestions(data.suggestions ?? []);
      setUpcoming(data.upcoming ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load today’s suggestions.");
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const dateLabel = useMemo(() => new Intl.DateTimeFormat("en", { weekday: "long", month: "long", day: "numeric" }).format(new Date()), []);

  return (
    <>
      <div className="page-header">
        <div>
          <div className="page-date">{dateLabel}</div>
          <h1 className="page-title">Make a good connection today.</h1>
          <p className="page-subtitle">A small, thoughtful list of people worth reaching out to, with the context you need before you write.</p>
        </div>
        <button className="button button-secondary" type="button" onClick={() => { setRefreshing(true); void load(); }} disabled={loading || refreshing}><RefreshCw size={15} className={refreshing ? "spin" : ""} aria-hidden="true" />Refresh</button>
      </div>

      <section aria-labelledby="today-heading">
        <div className="section-heading"><h2 id="today-heading">People to reach out to</h2><p>{suggestions.length ? `${suggestions.length} in focus` : "Your daily focus"}</p></div>
        {loading ? <div className="loading-state"><div><RefreshCw size={20} className="spin" aria-hidden="true" /><strong>Finding your next conversations...</strong><p>Checking cadence, priority, and your recent notes.</p></div></div> : error ? <div className="error-state"><div><RefreshCw size={20} aria-hidden="true" /><strong>Could not load your suggestions</strong><p>{error}</p><button className="button button-secondary" type="button" onClick={() => { setLoading(true); void load(); }}>Try again</button></div></div> : suggestions.length === 0 ? <div className="empty-state"><div><Sparkles size={24} aria-hidden="true" /><strong>{hasContacts ? "Your daily list is clear." : "Your network starts here."}</strong><p>{hasContacts ? "Your relationships are up to date. Browse your people or check back for the next suggested conversation." : "Import your LinkedIn connections, choose who matters, and Kinship will help you keep a natural rhythm."}</p><div className="empty-actions">{!hasContacts && <Link className="button button-accent" href="/onboarding">Import LinkedIn connections</Link>}<Link className="button button-secondary" href="/people">{hasContacts ? "Browse people" : "Add a person manually"}</Link></div></div></div> : <div className="suggestion-list">{suggestions.map((suggestion) => <SuggestionCard key={suggestion.id} suggestion={suggestion} onRefresh={load} />)}</div>}
      </section>

      {!loading && !error && upcoming.length > 0 ? <section className="section-block" aria-labelledby="upcoming-heading"><div className="section-heading"><h2 id="upcoming-heading">Coming up soon</h2><p>People approaching their cadence</p></div><div className="upcoming-list">{upcoming.slice(0, 5).map((person) => <Link className="upcoming-row" href={`/people/${person.id}`} key={person.id}><span className="upcoming-person"><PersonAvatar contactId={person.id} className="person-avatar" name={person.name} photoUrl={person.photo_url} uploadedPhotoUpdatedAt={person.uploaded_photo_updated_at} /><span className="upcoming-detail"><strong>{person.name}</strong><span>{[person.role, person.company].filter(Boolean).join(" at ") || "Professional connection"}</span></span></span><span className="upcoming-date"><CalendarDays size={13} aria-hidden="true" /> {formatDate(person.next_recommended_at)}</span></Link>)}</div></section> : null}
    </>
  );
}
