"use client";

import { useState } from "react";
import { Trash2, Upload } from "./icons";
import type { ContactFormValues, Priority } from "./crm-types";
import { emptyContactForm } from "./crm-utils";

type Props = {
  initial?: ContactFormValues;
  onSubmit: (values: ContactFormValues) => Promise<void>;
  onCancel?: () => void;
  submitLabel?: string;
  compact?: boolean;
  contactId?: string;
  uploadedPhotoUpdatedAt?: string | null;
  onPhotoUpload?: (file: File) => Promise<void>;
  onPhotoRemove?: () => Promise<void>;
};

export function PersonForm({ initial, onSubmit, onCancel, submitLabel = "Save person", compact = false, contactId, uploadedPhotoUpdatedAt, onPhotoUpload, onPhotoRemove }: Props) {
  const [values, setValues] = useState<ContactFormValues>(initial ?? emptyContactForm());
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [photoBusy, setPhotoBusy] = useState(false);
  const [photoError, setPhotoError] = useState("");
  const [photoNotice, setPhotoNotice] = useState("");

  const update = <K extends keyof ContactFormValues>(key: K, value: ContactFormValues[K]) => {
    setValues((current) => ({ ...current, [key]: value }));
  };

  const uploadPhoto = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.currentTarget.files?.[0];
    event.currentTarget.value = "";
    if (!file || !onPhotoUpload) return;
    setPhotoError("");
    setPhotoNotice("");
    if (!(["image/jpeg", "image/png", "image/webp"].includes(file.type))) {
      setPhotoError("Choose a JPEG, PNG, or WebP image.");
      return;
    }
    if (file.size > 4_000_000) {
      setPhotoError("Choose an image no larger than 4 MB.");
      return;
    }
    if (!file.size) {
      setPhotoError("Choose an image file that contains data.");
      return;
    }
    setPhotoBusy(true);
    try {
      await onPhotoUpload(file);
      setPhotoNotice("Photo uploaded and ready to use.");
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Could not upload this photo.");
    } finally {
      setPhotoBusy(false);
    }
  };

  const removePhoto = async () => {
    if (!onPhotoRemove) return;
    setPhotoBusy(true);
    setPhotoError("");
    setPhotoNotice("");
    try {
      await onPhotoRemove();
      setPhotoNotice("Uploaded photo removed.");
    } catch (err) {
      setPhotoError(err instanceof Error ? err.message : "Could not remove this photo.");
    } finally {
      setPhotoBusy(false);
    }
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
      <label className="form-field form-field-full">
        <span className="field-label">Photo URL</span>
        <input className="input" type="url" value={values.photo_url} onChange={(event) => update("photo_url", event.target.value)} placeholder="https://..." />
        <span className="field-hint">Used when there is no uploaded photo.</span>
      </label>
      {contactId && onPhotoUpload ? <div className="form-field form-field-full">
        <span className="field-label">Upload photo or icon</span>
        <div className="photo-upload-row">
          <label className="button button-secondary photo-upload-button"><Upload size={14} aria-hidden="true" />{photoBusy ? "Working..." : uploadedPhotoUpdatedAt ? "Replace photo" : "Choose image"}<input className="photo-file-input" type="file" accept="image/jpeg,image/png,image/webp" onChange={(event) => void uploadPhoto(event)} disabled={photoBusy || saving} /></label>
          {uploadedPhotoUpdatedAt && onPhotoRemove ? <button className="button button-quiet" type="button" onClick={() => void removePhoto()} disabled={photoBusy || saving}><Trash2 size={14} aria-hidden="true" />Remove upload</button> : null}
        </div>
        <span className="field-hint">JPEG, PNG, or WebP up to 4 MB. We crop it square and save a small WebP copy.</span>
        {photoError ? <span className="form-error" role="alert">{photoError}</span> : null}
        {photoNotice ? <span className="field-hint" role="status">{photoNotice}</span> : null}
      </div> : null}
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
