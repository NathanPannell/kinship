"use client";

import Link from "next/link";
import { useCallback, useEffect, useMemo, useState } from "react";
import { PersonForm } from "./person-form";
import { InteractionForm } from "./interaction-form";
import type { Contact, Interaction } from "./crm-types";
import { apiRequest, contactToForm, formatDateTime, initials, priorityClass, relativeContactDate } from "./crm-utils";
import { ArrowLeft, ArrowUpRight, CalendarDays, Check, Link2, Mail, MessageCircle, Pencil, Plus, RefreshCw, X } from "./icons";

type Props = { id: string };
type ContactResponse = { contact?: Contact; interactions?: Interaction[] };

function whatsApp(phone?: string | null) {
  const digits = phone?.replace(/\D/g, "") ?? "";
  return digits ? `https://wa.me/${digits}` : "";
}

export function PersonScreen({ id }: Props) {
  const [contact, setContact] = useState<Contact | null>(null);
  const [interactions, setInteractions] = useState<Interaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [editingPerson, setEditingPerson] = useState(false);
  const [interactionForm, setInteractionForm] = useState(false);
  const [editingInteraction, setEditingInteraction] = useState<Interaction | null>(null);
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async () => {
    setError("");
    try {
      const data = await apiRequest<ContactResponse>(`/api/contacts/${id}`);
      if (!data.contact) throw new Error("Person not found.");
      setContact(data.contact);
      setInteractions(data.interactions ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load this person.");
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const editValues = useMemo(() => contact ? contactToForm(contact) : undefined, [contact]);
  const savePerson = async (values: Parameters<React.ComponentProps<typeof PersonForm>["onSubmit"]>[0]) => {
    const data = await apiRequest<{ contact: Contact }>(`/api/contacts/${id}`, { method: "PATCH", body: JSON.stringify(values) });
    setContact(data.contact);
    setEditingPerson(false);
  };

  const saveInteraction = async (values: { channel: string; note: string; occurred_at?: string }) => {
    if (editingInteraction) {
      const data = await apiRequest<{ interaction?: Interaction }>(`/api/interactions/${editingInteraction.id}`, { method: "PATCH", body: JSON.stringify(values) });
      setInteractions((current) => current.map((item) => item.id === editingInteraction.id ? data.interaction ?? { ...item, ...values } as Interaction : item));
      setEditingInteraction(null);
    } else {
      const data = await apiRequest<{ interaction?: Interaction }>("/api/interactions", { method: "POST", body: JSON.stringify({ contact_id: id, ...values }) });
      if (data.interaction) setInteractions((current) => [data.interaction as Interaction, ...current]);
      setInteractionForm(false);
    }
    await load();
  };

  const deleteInteraction = async (interactionId: string) => {
    if (!window.confirm("Delete this interaction?")) return;
    setDeleting(interactionId);
    try {
      await apiRequest(`/api/interactions/${interactionId}`, { method: "DELETE" });
      setInteractions((current) => current.filter((item) => item.id !== interactionId));
      await load();
    } finally {
      setDeleting(null);
    }
  };

  if (loading) return <div className="loading-state"><div><RefreshCw size={20} className="spin" aria-hidden="true" /><strong>Opening this person...</strong></div></div>;
  if (error || !contact) return <div className="error-state"><div><RefreshCw size={20} aria-hidden="true" /><strong>Could not open this person</strong><p>{error || "Person not found."}</p><Link className="button button-secondary" href="/people">Back to People</Link></div></div>;

  const roleLine = [contact.role, contact.company].filter(Boolean).join(" at ") || "Professional connection";

  return (
    <>
      <Link className="person-back" href="/people"><ArrowLeft size={15} aria-hidden="true" />Back to People</Link>
      <div className="profile-header">
        <div className="profile-identity"><span className="person-avatar-large" aria-hidden="true">{initials(contact.name)}</span><div className="profile-copy"><h1>{contact.name}</h1><p>{roleLine}</p><span className={priorityClass(contact.priority)}>{contact.priority} priority</span></div></div>
        <div className="profile-actions">
          {contact.linkedin_url ? <a className="button button-secondary" href={contact.linkedin_url} target="_blank" rel="noreferrer"><Link2 size={15} aria-hidden="true" />LinkedIn<ArrowUpRight size={12} aria-hidden="true" /></a> : null}
          {contact.phone ? <a className="button button-secondary" href={whatsApp(contact.phone)} target="_blank" rel="noreferrer"><MessageCircle size={15} aria-hidden="true" />WhatsApp</a> : null}
          {contact.email ? <a className="button button-secondary" href={`mailto:${contact.email}`}><Mail size={15} aria-hidden="true" />Email</a> : null}
          <button className="button button-primary" type="button" onClick={() => setInteractionForm(true)}><Plus size={15} aria-hidden="true" />Add interaction</button>
        </div>
      </div>

      <div className="profile-details">
        <div className="detail-item"><span className="detail-label">Last contact</span><span className="detail-value">{relativeContactDate(contact.last_contacted_at)}</span></div>
        <div className="detail-item"><span className="detail-label">Cadence</span><span className="detail-value">Every {contact.cadence_days} days</span></div>
        <div className="detail-item"><span className="detail-label">Email</span><span className="detail-value">{contact.email ? <a href={`mailto:${contact.email}`}>{contact.email}</a> : "Not added"}</span></div>
        <div className="detail-item"><span className="detail-label">Location</span><span className="detail-value">{contact.location || "Not added"}</span></div>
      </div>
      {contact.notes ? <div className="profile-notes"><span className="detail-label">Notes</span><p>{contact.notes}</p></div> : null}

      <div className="button-row" style={{ marginTop: 21 }}><button className="button button-secondary" type="button" onClick={() => setEditingPerson((open) => !open)}><Pencil size={14} aria-hidden="true" />Edit person</button><button className="button button-quiet" type="button" onClick={() => setInteractionForm(true)}><Check size={14} aria-hidden="true" />Mark contacted today</button></div>
      {editingPerson && editValues ? <section className="create-panel" style={{ marginTop: 18 }} aria-labelledby="edit-person-heading"><div className="quick-form-head"><h2 id="edit-person-heading">Edit person</h2><button className="icon-button" type="button" onClick={() => setEditingPerson(false)} aria-label="Close edit form"><X size={16} aria-hidden="true" /></button></div><PersonForm initial={editValues} onCancel={() => setEditingPerson(false)} onSubmit={savePerson} submitLabel="Save person" /></section> : null}

      <section className="section-block" aria-labelledby="timeline-heading"><div className="section-heading"><h2 id="timeline-heading">Interaction history</h2><p>{interactions.length ? `${interactions.length} logged` : "Nothing logged yet"}</p></div>
        {interactionForm ? <div className="create-panel" style={{ marginBottom: 18 }}><div className="quick-form-head"><h2>Log an interaction</h2><button className="icon-button" type="button" onClick={() => setInteractionForm(false)} aria-label="Close interaction form"><X size={16} aria-hidden="true" /></button></div><InteractionForm onCancel={() => setInteractionForm(false)} onSubmit={saveInteraction} /></div> : null}
        {interactions.length === 0 && !interactionForm ? <div className="empty-state"><div><CalendarDays size={21} aria-hidden="true" /><strong>No interactions yet.</strong><p>Log the first touchpoint while the context is fresh.</p><button className="button button-accent" type="button" onClick={() => setInteractionForm(true)} style={{ marginTop: 14 }}><Plus size={15} aria-hidden="true" />Add interaction</button></div></div> : <div className="timeline">{interactions.map((interaction) => <div className="timeline-item" key={interaction.id}><span className="timeline-dot" aria-hidden="true" /><div className="timeline-head"><strong>{interaction.channel}</strong><time dateTime={interaction.occurred_at}>{formatDateTime(interaction.occurred_at)}</time></div><p className="timeline-note">{interaction.note}</p><div className="timeline-actions"><button type="button" onClick={() => setEditingInteraction(interaction)}>Edit</button><button type="button" onClick={() => void deleteInteraction(interaction.id)} disabled={deleting === interaction.id}>{deleting === interaction.id ? "Deleting..." : "Delete"}</button></div>{editingInteraction?.id === interaction.id ? <div className="timeline-edit"><InteractionForm initial={interaction} onCancel={() => setEditingInteraction(null)} onSubmit={saveInteraction} /></div> : null}</div>)}</div>}
      </section>
    </>
  );
}
