"use client";
import { FormEvent, useState } from "react";
import { useRouter } from "next/navigation";

export default function LoginClient({ githubEnabled, passwordEnabled }: { githubEnabled: boolean; passwordEnabled: boolean }) {
  const router = useRouter();
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  async function submit(event: FormEvent) {
    event.preventDefault(); setBusy(true); setError("");
    const response = await fetch("/api/auth/password", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ password }) });
    setBusy(false);
    if (!response.ok) { setError("That password did not work."); return; }
    router.push("/"); router.refresh();
  }
  return <main className="flex min-h-screen items-center justify-center bg-[#f7f8f6] p-5 text-[#17251d]">
    <div className="w-full max-w-sm rounded-2xl border border-[#dfe5dc] bg-white p-8 shadow-sm">
      <div className="mb-8 flex items-center gap-3"><div className="flex size-10 items-center justify-center rounded-xl bg-[#214d37] text-lg font-semibold text-white">K</div><span className="text-sm font-semibold tracking-wide">KINSHIP</span></div>
      <h1 className="text-2xl font-semibold tracking-tight">Welcome back</h1>
      <p className="mt-2 text-sm text-[#607167]">Your relationships, ready when you are.</p>
      {githubEnabled && <a href="/api/auth/github" className="mt-8 flex h-11 items-center justify-center rounded-lg bg-[#214d37] text-sm font-medium text-white hover:bg-[#173d2b]">Continue with GitHub</a>}
      {githubEnabled && passwordEnabled && <div className="my-6 flex items-center gap-3 text-xs text-[#819086]"><span className="h-px flex-1 bg-[#e1e7df]"/>or use your private password<span className="h-px flex-1 bg-[#e1e7df]"/></div>}
      {passwordEnabled && <form onSubmit={submit} className="mt-6 space-y-3"><label htmlFor="password" className="block text-sm font-medium">Password</label><input id="password" type="password" autoComplete="current-password" value={password} onChange={(e) => setPassword(e.target.value)} className="h-11 w-full rounded-lg border border-[#cbd7cd] px-3 outline-none focus:border-[#214d37]" required/><button disabled={busy} className="h-11 w-full rounded-lg border border-[#cbd7cd] text-sm font-medium hover:bg-[#f6f8f5] disabled:opacity-50">{busy ? "Signing in…" : "Sign in"}</button></form>}
      {error && <p role="alert" className="mt-4 text-sm text-red-700">{error}</p>}
    </div>
  </main>;
}
