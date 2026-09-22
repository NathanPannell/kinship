"use client";

import { useState } from "react";
import type { ContactFormValues, Priority } from "./crm-types";
import { emptyContactForm } from "./crm-utils";

type Props = {
  initial?: ContactFormValues;
  onSubmit: (values: ContactFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  compact?: boolean;
};

export function PersonForm({ initial, onSubmit, onCancel, submitLabel = "Save person", compact = false }: Props) {
  const [values, setValues] = useState<ContactFormValues>(initial ?? emptyContactForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const update = <K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!values.name.trim()) {
      setError("Add a name to save this person.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit({ ...values, name: values.name.trim(), cadence_days: Number(values.cadence_days) || 45 });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this person.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="form-field form-field-full">
        <span className="field-label">Name</span>
        <input className="input" value={values.name} onChange={(event) => update("name", event.target.value)} placeholder="Full name" autoFocus={!compact} required />
      </label>
      <label className="form-field">
        <span className="field-label">Company</span>
        <input className="input" value={values.company} onChange={(event) => update("company", event.target.value)} placeholder="Company" />
      </label>
      <label className="form-field">
        <span className="field-label">Role</span>
        <input className="input" value={values.role} onChange={(event) => update("role", event.target.value)} placeholder="Role or title" />
      </label>
      <label className="form-field">
        <span className="field-label">Priority</span>
        <select className="select" value={values.priority} onChange={(event) => update("priority", event.target.value as Priority)}>
          <option value="high">High</option>
          <option value="normal">Normal</option>
          <option value="low">Low</option>
        </select>
      </label>
      <label className="form-field">
        <span className="field-label">Cadence in days</span>
        <input className="input" type="number" min={1} max={3650} value={values.cadence_days} onChange={(event) => update("cadence_days", Number(event.target.value))} />
      </label>
      <label className="form-field">
        <span className="field-label">Email</span>
        <input className="input" type="email" value={values.email} onChange={(event) => update("email", event.target.value)} placeholder="name@example.com" />
      </label>
      <label className="form-field">
        <span className="field-label">Phone</span>
        <input className="input" type="tel" value={values.phone} onChange={(event) => update("phone", event.target.value)} placeholder="Phone number" />
      </label>
      <label className="form-field form-field-full">
        <span className="field-label">LinkedIn URL</span>
        <input className="input" type="url" value={values.linkedin_url} onChange={(event) => update("linkedin_url", event.target.value)} placeholder="https://linkedin.com/in/..." />
      </label>
      <label className="form-field">
        <span className="field-label">Location</span>
        <input className="input" value={values.location} onChange={(event) => update("location", event.target.value)} placeholder="City or region" />
      </label>
      <label className="form-field form-field-full">
        <span className="field-label">Notes</span>
        <textarea className="textarea" value={values.notes} onChange={(event) => update("notes", event.target.value)} placeholder="What should you remember about this relationship?" />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="button-row form-field-full">
        <button className="button button-primary" type="submit" disabled={saving}>{saving ? "Saving..." : submitLabel}</button>
        {onCancel ? <button className="button button-quiet" type="button" onClick={onCancel} disabled={saving}>Cancel</button> : null}
      </div>
    </form>
  );
}
