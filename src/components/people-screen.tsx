"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { PersonForm } from "./person-form";
import type { Contact } from "./crm-types";
import { apiRequest, formatDate, initials, nextDueDate, priorityClass } from "./crm-utils";
import { ChevronRight, Filter, Plus, RefreshCw, Search, Users, X } from "./icons";
import { useRouter } from "next/navigation";

type ContactsResponse = { contacts?: Contact[] };

export function PeopleScreen() {
  const router = useRouter();
  const [contacts, setContacts] = useState<Contact[]>([]);
  const [search, setSearch] = useState("");
  const [priority, setPriority] = useState("");
  const [overdue, setOverdue] = useState(false);
  const [sort, setSort] = useState("last_contacted");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [creating, setCreating] = useState(false);

  const load = useCallback(async () => {
    setError("");
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (priority) params.set("priority", priority);
    if (overdue) params.set("overdue", "true");
    if (sort) params.set("sort", sort);
    try {
      const data = await apiRequest<ContactsResponse>(`/api/contacts?${params.toString()}`);
      setContacts(data.contacts ?? []);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not load contacts.");
    } finally {
      setLoading(false);
    }
  }, [overdue, priority, search, sort]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), search ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [load, search]);

  const createPerson = async (values: Parameters<React.ComponentProps<typeof PersonForm>["onSubmit"]>[0]) => {
    const result = await apiRequest<{ contact: Contact }>("/api/contacts", { method: "POST", body: JSON.stringify(values) });
    router.push(`/people/${result.contact.id}`);
  };

  return (
    <>
      <div className="page-header">
        <div><div className="page-date">Your circle</div><h1 className="page-title">People.</h1><p className="page-subtitle">Keep the important relationships close enough to remember and easy enough to tend.</p></div>
        <button className="button button-primary" type="button" onClick={() => setCreating((open) => !open)}><Plus size={16} aria-hidden="true" />Add person</button>
      </div>

      {creating ? <section className="create-panel" aria-labelledby="create-heading"><div className="quick-form-head"><h2 id="create-heading">Add someone to your circle</h2><button className="icon-button" type="button" onClick={() => setCreating(false)} aria-label="Close add person form"><X size={16} aria-hidden="true" /></button></div><PersonForm submitLabel="Create person" onCancel={() => setCreating(false)} onSubmit={createPerson} /></section> : null}

      <div className="search-toolbar" aria-label="People filters">
        <label className="search-input-wrap"><Search size={16} aria-hidden="true" /><span className="sr-only">Search people</span><input className="input search-input" value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search name, company, or role" /></label>
        <select className="select toolbar-select" value={sort} onChange={(event) => setSort(event.target.value)} aria-label="Sort people"><option value="last_contacted">Sort by last contact</option><option value="next_due">Sort by next due</option></select>
        <select className="select toolbar-select" value={priority} onChange={(event) => setPriority(event.target.value)} aria-label="Filter by priority"><option value="">All priorities</option><option value="high">High priority</option><option value="normal">Normal priority</option><option value="low">Low priority</option></select>
        <button className={`toolbar-toggle ${overdue ? "is-active" : ""}`} type="button" onClick={() => setOverdue((active) => !active)} aria-pressed={overdue}><Filter size={14} aria-hidden="true" />Overdue</button>
      </div>

      {error ? <div className="error-state"><div><RefreshCw size={20} aria-hidden="true" /><strong>Could not load your people</strong><p>{error}</p><button className="button button-secondary" type="button" onClick={() => { setLoading(true); void load(); }}>Try again</button></div></div> : loading ? <div className="loading-state"><div><RefreshCw size={20} className="spin" aria-hidden="true" /><strong>Loading your circle...</strong></div></div> : contacts.length === 0 ? <div className="empty-state"><div><Users size={21} aria-hidden="true" /><strong>No people match this view.</strong><p>Try clearing a filter or add someone new to start your list.</p>{(search || priority || overdue) ? <button className="button button-secondary" type="button" onClick={() => { setSearch(""); setPriority(""); setOverdue(false); }}>Clear filters</button> : null}</div></div> : <div className="people-list">{contacts.map((contact) => <Link className="people-row" href={`/people/${contact.id}`} key={contact.id}><span className="person-heading people-row-link"><span className="person-avatar" aria-hidden="true">{initials(contact.name)}</span><span className="person-heading-copy"><span className="person-name">{contact.name}</span><span className="person-role">{contact.role || "No role added"}</span></span></span><span className="people-secondary"><span>{contact.company || "Independent"}</span><span className="muted">Last contact: {formatDate(contact.last_contacted_at)}</span></span><span className="people-dates"><span>Next suggested</span>{nextDueDate(contact)}</span><span className={priorityClass(contact.priority)}>{contact.priority}</span><ChevronRight className="row-arrow" size={17} aria-hidden="true" /></Link>)}</div>}
      {!loading && !error && contacts.length > 0 ? <p className="section-heading" style={{ justifyContent: "flex-start", marginTop: 17 }}><span>{contacts.length} {contacts.length === 1 ? "person" : "people"}</span></p> : null}
    </>
  );
}
