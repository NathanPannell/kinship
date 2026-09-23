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

  return <div className="mt-6">
    <label htmlFor="delete-confirmation" className="block text-sm font-medium">Type DELETE MY ACCOUNT to confirm</label>
    <input id="delete-confirmation" value={confirmation} onChange={(event) => setConfirmation(event.target.value)}
      className="mt-2 h-10 w-full max-w-sm rounded-lg border border-[#cbd7cd] px-3" autoComplete="off" />
    <div><button type="button" disabled={busy || confirmation !== "DELETE MY ACCOUNT"} onClick={remove}
      className="mt-4 rounded-lg bg-red-700 px-4 py-2 text-sm font-medium text-white disabled:opacity-40">{busy ? "Deleting…" : "Delete account and data"}</button></div>
    {error && <p role="alert" className="mt-3 text-sm text-red-700">{error}</p>}
  </div>;
}
