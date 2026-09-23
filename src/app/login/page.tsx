import type { Metadata } from "next";
import Link from "next/link";
import { PublicShell } from "@/components/public-shell";

export const metadata: Metadata = {
  title: "Sign in · Kinship",
  description: "Sign in to your private Kinship workspace with Google.",
};

export default function LoginPage() {
  const googleEnabled = Boolean(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET);

  return <PublicShell>
    <section className="mx-auto flex min-h-[620px] w-full max-w-md items-center py-16">
      <div className="w-full rounded-2xl border border-[#dedbd2] bg-[#fffefb] p-8 shadow-[0_18px_40px_rgba(47,45,39,0.10)]">
        <p className="mb-3 text-xs font-bold uppercase tracking-[0.1em] text-[#8f422b]">Your private workspace</p>
        <h1 className="text-3xl font-semibold tracking-[-0.045em] text-[#20231f]">Welcome to Kinship</h1>
        <p className="mt-3 text-sm leading-6 text-[#61665e]">Sign in with Google to keep your contacts, interaction history, and API tokens separate from every other account.</p>
        {googleEnabled ? <a href="/api/auth/google" className="mt-8 flex h-12 items-center justify-center gap-3 rounded-lg border border-[#c6c1b7] bg-white px-5 text-sm font-semibold text-[#20231f] transition-colors hover:bg-[#f4f1eb]">
          <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
            <path fill="#4285F4" d="M17.64 9.205c0-.638-.057-1.252-.164-1.841H9v3.482h4.844a4.14 4.14 0 0 1-1.797 2.716v2.258h2.909c1.703-1.568 2.684-3.878 2.684-6.615Z" />
            <path fill="#34A853" d="M9 18c2.43 0 4.468-.806 5.956-2.18l-2.909-2.258c-.806.54-1.836.86-3.047.86-2.344 0-4.328-1.585-5.037-3.714H.956v2.332A9 9 0 0 0 9 18Z" />
            <path fill="#FBBC05" d="M3.963 10.708A5.42 5.42 0 0 1 3.68 9c0-.593.102-1.17.283-1.708V4.96H.956A9 9 0 0 0 0 9c0 1.452.347 2.827.956 4.04l3.007-2.332Z" />
            <path fill="#EA4335" d="M9 3.578c1.322 0 2.508.454 3.441 1.346l2.581-2.582C13.464.891 11.426 0 9 0A9 9 0 0 0 .956 4.96l3.007 2.332C4.672 5.163 6.656 3.578 9 3.578Z" />
          </svg>
          Continue with Google
        </a> : <div className="mt-8 rounded-lg bg-[#f5e9c8] p-4 text-sm leading-6 text-[#72551d]" role="status">Google sign-in is being configured. Please try again shortly.</div>}
        <p className="mt-6 text-xs leading-5 text-[#767b73]">Kinship requests your basic Google profile and email for sign-in. By continuing, you agree to the <Link className="underline underline-offset-2 hover:text-[#20231f]" href="/terms">Terms</Link> and acknowledge the <Link className="underline underline-offset-2 hover:text-[#20231f]" href="/privacy">Privacy Policy</Link>.</p>
      </div>
    </section>
  </PublicShell>;
}
