"use client";

import { useRef, useState } from "react";
import { apiRequest } from "./crm-utils";
import { FileUp, RefreshCw, Upload, X } from "./icons";

type PreviewRow = { name?: string; company?: string | null; role?: string | null; linkedin_url?: string | null; email?: string | null; [key: string]: unknown };
type Preview = { create: number; update: number; skipped: number; preview: PreviewRow[] };

export function ImportScreen() {
  const inputRef = useRef<HTMLInputElement>(null);
  const [file, setFile] = useState<File | null>(null);
  const [preview, setPreview] = useState<Preview | null>(null);
  const [dragging, setDragging] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");
  const [error, setError] = useState("");

  const selectFile = (next: File | undefined) => {
    if (!next) return;
    setError("");
    setMessage("");
    setPreview(null);
    if (!next.name.toLowerCase().endsWith(".csv")) {
      setError("Choose the CSV file exported from LinkedIn.");
      return;
    }
    setFile(next);
  };

  const sendFile = async (endpoint: string) => {
    if (!file) return;
    setBusy(true);
    setError("");
    setMessage("");
    const form = new FormData();
    form.set("file", file);
    try {
      if (endpoint.endsWith("preview")) {
        setPreview(await apiRequest<Preview>(endpoint, { method: "POST", body: form }));
      } else {
        const result = await apiRequest<{ created?: number; updated?: number }>(endpoint, { method: "POST", body: form });
        setMessage(`Import complete. ${result.created ?? 0} created and ${result.updated ?? 0} updated.`);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Could not process this CSV.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <>
      <div className="page-header"><div><div className="page-date">Bring your circle along</div><h1 className="page-title">Import connections.</h1><p className="page-subtitle">Start with your official LinkedIn Connections CSV. We will use LinkedIn URLs to recognize people you already know.</p></div></div>
      <div className="import-layout">
        <section className="import-card" aria-labelledby="import-heading"><h2 id="import-heading">LinkedIn Connections CSV</h2><p>Preview changes before they touch your people list. Existing notes, cadence, priorities, and interaction history stay in place.</p>
          <div className={`dropzone ${dragging ? "is-dragging" : ""}`} onDragOver={(event) => { event.preventDefault(); setDragging(true); }} onDragLeave={() => setDragging(false)} onDrop={(event) => { event.preventDefault(); setDragging(false); selectFile(event.dataTransfer.files[0]); }}>
            <div><div className="dropzone-icon"><Upload size={19} aria-hidden="true" /></div><strong>Drop your CSV here</strong><span>or choose a file from your computer</span><input ref={inputRef} type="file" accept=".csv,text/csv" onChange={(event) => selectFile(event.target.files?.[0])} /><button className="button button-secondary" type="button" onClick={() => inputRef.current?.click()}>Choose CSV</button></div>
          </div>
          {file ? <div className="selected-file"><span><FileUp size={14} aria-hidden="true" /> {file.name}</span><button className="icon-button" type="button" onClick={() => { setFile(null); setPreview(null); }} aria-label="Remove selected file"><X size={15} aria-hidden="true" /></button></div> : null}
          {error ? <p className="form-error" style={{ marginTop: 14 }}>{error}</p> : null}
          {message ? <p className="notice" role="status">{message}</p> : null}
          <div className="import-actions"><button className="button button-secondary" type="button" onClick={() => void sendFile("/api/import/preview")} disabled={!file || busy}>{busy ? <RefreshCw size={15} className="spin" aria-hidden="true" /> : null}Preview changes</button>{preview ? <button className="button button-accent" type="button" onClick={() => void sendFile("/api/import/commit")} disabled={busy}>Import {preview.create + preview.update} contacts</button> : null}</div>
          {preview ? <div aria-live="polite"><div className="preview-summary"><div className="preview-count"><strong>{preview.create}</strong><span>to create</span></div><div className="preview-count"><strong>{preview.update}</strong><span>to update</span></div><div className="preview-count"><strong>{preview.skipped}</strong><span>skipped</span></div></div>{preview.preview.length ? <div className="preview-table-wrap"><table className="preview-table"><thead><tr><th>Name</th><th>Company</th><th>Role</th><th>Match</th></tr></thead><tbody>{preview.preview.map((row, index) => <tr key={`${String(row.name)}-${index}`}><td><strong>{row.name || "Unnamed"}</strong></td><td>{row.company || ""}</td><td>{row.role || ""}</td><td>{index < preview.create ? "New" : "Update"}</td></tr>)}</tbody></table></div> : null}</div> : null}
        </section>
        <aside className="import-aside"><h2>How it works</h2><p>LinkedIn stays the source for connection details. Kinship keeps the relationship context you add here.</p><ol><li>Export your Connections CSV from LinkedIn.</li><li>Choose it here and review the preview.</li><li>Commit the changes when the list looks right.</li></ol></aside>
      </div>
    </>
  );
}
