"use client";

import Link from "next/link";
import { useCallback, useEffect, useRef, useState } from "react";
import { PersonForm } from "./person-form";
import type { Contact, Priority } from "./crm-types";
import { apiRequest, formatDate, nextDueDate, priorityClass } from "./crm-utils";
import { PersonAvatar } from "./person-avatar";
import { ChevronRight, Filter, Plus, RefreshCw, Search, Trash2, Users, X } from "./icons";
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
  const [selectedIds, setSelectedIds] = useState<Set<string>>(() => new Set());
  const [bulkPriority, setBulkPriority] = useState<Priority | "">("");
  const [bulkCadence, setBulkCadence] = useState("");
  const [bulkBusy, setBulkBusy] = useState(false);
  const [bulkError, setBulkError] = useState("");
  const [bulkNotice, setBulkNotice] = useState("");
  const requestGeneration = useRef(0);

  const load = useCallback(async (generation?: number) => {
    const currentGeneration = generation ?? ++requestGeneration.current;
    setLoading(true);
    setError("");
    const params = new URLSearchParams();
    if (search.trim()) params.set("search", search.trim());
    if (priority) params.set("priority", priority);
    if (overdue) params.set("overdue", "true");
    if (sort) params.set("sort", sort);
    try {
      const data = await apiRequest<ContactsResponse>(`/api/contacts?${params.toString()}`);
      if (currentGeneration === requestGeneration.current) setContacts(data.contacts ?? []);
    } catch (err) {
      if (currentGeneration === requestGeneration.current) setError(err instanceof Error ? err.message : "Could not load contacts.");
    } finally {
      if (currentGeneration === requestGeneration.current) setLoading(false);
    }
  }, [overdue, priority, search, sort]);

  useEffect(() => {
    const generation = ++requestGeneration.current;
    const timer = window.setTimeout(() => void load(generation), search ? 250 : 0);
    // Hide the previous result set while the active filter is loading.
    // Selection can remain across filters, but select-all must use the current result.
    if (generation > 1) setLoading(true);
    return () => window.clearTimeout(timer);
  }, [load, search]);

  const createPerson = async (values: Parameters<React.ComponentProps<typeof PersonForm>["onSubmit"]>[0]) => {
    const result = await apiRequest<{ contact: Contact }>("/api/contacts", { method: "POST", body: JSON.stringify(values) });
    router.push(`/people/${result.contact.id}`);
  };

  const visibleIds = contacts.map((contact) => contact.id);
  const allVisibleSelected = visibleIds.length > 0 && visibleIds.every((id) => selectedIds.has(id));
  const selectedCount = selectedIds.size;

  const togglePerson = (id: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    setBulkError("");
    setBulkNotice("");
  };

  const toggleVisible = () => {
    setSelectedIds((current) => {
      const next = new Set(current);
      for (const id of visibleIds) {
        if (allVisibleSelected) next.delete(id);
        else next.add(id);
      }
      return next;
    });
    setBulkError("");
    setBulkNotice("");
  };

  const applyBulkChanges = async () => {
    if (!selectedCount || (!bulkPriority && !bulkCadence)) return;
    const cadence = bulkCadence ? Number(bulkCadence) : undefined;
    if (cadence !== undefined && (!Number.isInteger(cadence) || cadence < 1 || cadence > 3650)) {
      setBulkError("Cadence must be a whole number from 1 to 3650 days.");
      return;
    }
    setBulkBusy(true);
    setBulkError("");
    setBulkNotice("");
    try {
      const result = await apiRequest<{ updated: number }>("/api/contacts/bulk", {
        method: "POST",
        body: JSON.stringify({ ids: Array.from(selectedIds), updates: { ...(bulkPriority ? { priority: bulkPriority } : {}), ...(cadence !== undefined ? { cadence_days: cadence } : {}) } }),
      });
      setSelectedIds(new Set());
      setBulkPriority("");
      setBulkCadence("");
      setBulkNotice(`Updated ${result.updated} ${result.updated === 1 ? "person" : "people"}.`);
      await load();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Could not update the selected people.");
    } finally {
      setBulkBusy(false);
    }
  };

  const deleteSelected = async () => {
    if (!selectedCount || !window.confirm(`Delete the ${selectedCount} selected ${selectedCount === 1 ? "person" : "people"}? This cannot be undone.`)) return;
    setBulkBusy(true);
    setBulkError("");
    setBulkNotice("");
    try {
      const result = await apiRequest<{ deleted: number }>("/api/contacts/bulk", {
        method: "DELETE",
        body: JSON.stringify({ ids: Array.from(selectedIds) }),
      });
      setSelectedIds(new Set());
      setBulkNotice(`Deleted ${result.deleted} ${result.deleted === 1 ? "person" : "people"}.`);
      await load();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Could not delete the selected people.");
    } finally {
      setBulkBusy(false);
    }
  };

  const deleteEveryone = async () => {
    const typed = window.prompt("This deletes every person in your circle, including people hidden by filters. Type DELETE EVERYONE to confirm.");
    if (typed !== "DELETE EVERYONE") return;
    setBulkBusy(true);
    setBulkError("");
    setBulkNotice("");
    try {
      const result = await apiRequest<{ deleted: number }>("/api/contacts", {
        method: "DELETE",
        body: JSON.stringify({ confirmation: "DELETE_ALL_CONTACTS" }),
      });
      setSelectedIds(new Set());
      setBulkNotice(`Deleted all ${result.deleted} ${result.deleted === 1 ? "person" : "people"}.`);
      await load();
    } catch (err) {
      setBulkError(err instanceof Error ? err.message : "Could not delete everyone.");
    } finally {
      setBulkBusy(false);
    }
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

      {selectedCount > 0 ? <section className="people-bulk-panel" aria-label="Actions for selected people">
        <div className="people-bulk-heading"><strong>{selectedCount} {selectedCount === 1 ? "person" : "people"} selected</strong><button className="text-button" type="button" onClick={() => setSelectedIds(new Set())} disabled={bulkBusy}>Clear selection</button></div>
        <p>Changes below apply only to your selection, including people hidden by filters.</p>
        <div className="people-bulk-controls">
          <label className="people-bulk-field">Priority<select className="select" value={bulkPriority} onChange={(event) => setBulkPriority(event.target.value as Priority | "")} disabled={bulkBusy}><option value="">Keep current</option><option value="high">High</option><option value="normal">Normal</option><option value="low">Low</option></select></label>
          <label className="people-bulk-field">Cadence in days<input className="input" type="number" min="1" max="3650" step="1" value={bulkCadence} onChange={(event) => setBulkCadence(event.target.value)} placeholder="Keep current" disabled={bulkBusy} /></label>
          <button className="button button-primary" type="button" onClick={() => void applyBulkChanges()} disabled={bulkBusy || (!bulkPriority && !bulkCadence)}>{bulkBusy ? "Working..." : "Apply to selected"}</button>
          <button className="button button-danger" type="button" onClick={() => void deleteSelected()} disabled={bulkBusy}><Trash2 size={14} aria-hidden="true" />Delete selected</button>
        </div>
      </section> : null}

      {bulkError ? <p className="people-bulk-message people-bulk-error" role="alert">{bulkError}</p> : null}
      {bulkNotice ? <p className="people-bulk-message" role="status">{bulkNotice}</p> : null}

      {error ? <div className="error-state"><div><RefreshCw size={20} aria-hidden="true" /><strong>Could not load your people</strong><p>{error}</p><button className="button button-secondary" type="button" onClick={() => { setLoading(true); void load(); }}>Try again</button></div></div> : loading ? <div className="loading-state"><div><RefreshCw size={20} className="spin" aria-hidden="true" /><strong>Loading your circle...</strong></div></div> : contacts.length === 0 ? <div className="empty-state"><div><Users size={21} aria-hidden="true" /><strong>No people match this view.</strong><p>Try clearing a filter or add someone new to start your list.</p>{(search || priority || overdue) ? <button className="button button-secondary" type="button" onClick={() => { setSearch(""); setPriority(""); setOverdue(false); }}>Clear filters</button> : null}</div></div> : <>
        <div className="people-select-row"><label><input className="people-checkbox" type="checkbox" checked={allVisibleSelected} onChange={toggleVisible} disabled={bulkBusy} />Select all shown</label><span>{contacts.length} shown</span></div>
        <div className="people-list">{contacts.map((contact) => <div className={`people-list-item ${selectedIds.has(contact.id) ? "is-selected" : ""}`} key={contact.id}><label className="people-select-cell"><input className="people-checkbox" type="checkbox" checked={selectedIds.has(contact.id)} onChange={() => togglePerson(contact.id)} disabled={bulkBusy} aria-label={`Select ${contact.name}`} /></label><Link className="people-row" href={`/people/${contact.id}`}><span className="person-heading people-row-link"><PersonAvatar className="person-avatar" name={contact.name} photoUrl={contact.photo_url} /><span className="person-heading-copy"><span className="person-name">{contact.name}</span><span className="person-role">{contact.role || "No role added"}</span></span></span><span className="people-secondary"><span>{contact.company || "Independent"}</span><span className="muted">Last contact: {formatDate(contact.last_contacted_at)}</span></span><span className="people-dates"><span>Next suggested</span>{nextDueDate(contact)}</span><span className={priorityClass(contact.priority)}>{contact.priority}</span><ChevronRight className="row-arrow" size={17} aria-hidden="true" /></Link></div>)}</div>
      </>}
      {!loading && !error && contacts.length > 0 ? <p className="section-heading" style={{ justifyContent: "flex-start", marginTop: 17 }}><span>{contacts.length} {contacts.length === 1 ? "person" : "people"} shown</span></p> : null}
      {!loading && !error ? <div className="people-delete-all"><div><strong>Reset your circle</strong><p>Delete everyone, including people hidden by the current filters.</p></div><button className="button button-danger" type="button" onClick={() => void deleteEveryone()} disabled={bulkBusy}><Trash2 size={14} aria-hidden="true" />Delete everyone</button></div> : null}
    </>
  );
}
