"use client";

import { useState } from "react";
import { channelOptions, type Channel, type Interaction } from "./crm-types";

type Props = {
  initial?: Partial<Interaction>;
  onSubmit: (values: { channel: Channel; note: string; occurred_at?: string }) => Promise<void>;
  onCancel?: () => void;
  compact?: boolean;
};

export function InteractionForm({ initial, onSubmit, onCancel, compact = false }: Props) {
  const [channel, setChannel] = useState<Channel>((initial?.channel as Channel) ?? "Other");
  const [note, setNote] = useState(initial?.note ?? "");
  const [occurredAt, setOccurredAt] = useState(initial?.occurred_at ? new Date(initial.occurred_at).toISOString().slice(0, 16) : "");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  const submit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!note.trim()) {
      setError("Add a short note so future you has the context.");
      return;
    }
    setSaving(true);
    setError("");
    try {
      await onSubmit({ channel, note: note.trim(), occurred_at: occurredAt ? new Date(occurredAt).toISOString() : undefined });
      if (!initial) {
        setNote("");
        setOccurredAt("");
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not save this interaction.");
    } finally {
      setSaving(false);
    }
  };

  return (
    <form className="form-grid" onSubmit={submit}>
      <label className="form-field">
        <span className="field-label">Channel</span>
        <select className="select" value={channel} onChange={(event) => setChannel(event.target.value as Channel)}>
          {channelOptions.map((option) => <option value={option} key={option}>{option}</option>)}
        </select>
      </label>
      {!compact ? (
        <label className="form-field">
          <span className="field-label">When</span>
          <input className="input" type="datetime-local" value={occurredAt} onChange={(event) => setOccurredAt(event.target.value)} />
        </label>
      ) : null}
      <label className="form-field form-field-full">
        <span className="field-label">What happened?</span>
        <textarea className="textarea" value={note} onChange={(event) => setNote(event.target.value)} placeholder="Coffee at Tenfold. Talked about..." autoFocus={compact} />
      </label>
      {error ? <p className="form-error">{error}</p> : null}
      <div className="button-row form-field-full">
        <button className="button button-accent" type="submit" disabled={saving}>{saving ? "Saving..." : initial ? "Save changes" : "Save interaction"}</button>
        {onCancel ? <button className="button button-quiet" type="button" onClick={onCancel} disabled={saving}>Cancel</button> : null}
      </div>
    </form>
  );
}
