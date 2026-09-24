"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";

export function DeleteAccount() {
  const router = useRouter();
  const [confirmation, setConfirmation] = useState("");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  async function remove() {
    setBusy(true);
    setError("");
    try {
      const response = await fetch("/api/account", {
        method: "DELETE",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ confirmation }),
      });
      if (!response.ok) throw new Error("Account deletion failed. Please try again.");
      router.push("/login");
      router.refresh();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Account deletion failed.");
      setBusy(false);
    }
  }

  return <div className="settings-delete-form">
    <label htmlFor="delete-confirmation" className="field-label">Type DELETE MY ACCOUNT to confirm</label>
    <input id="delete-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
      className="input" autoComplete="off" aria-describedby="delete-account-hint" />
    <p id="delete-account-hint">This action cannot be undone from Kinship.</p>
    <div><button type="button" disabled={busy || confirmation !== "DELETE MY ACCOUNT"} onClick={remove}
      className="button button-danger">{busy ? "Deleting…" : "Permanently delete account"}</button></div>
    {error && <p role="alert" className="form-error">{error}</p>}
  </div>;
}
