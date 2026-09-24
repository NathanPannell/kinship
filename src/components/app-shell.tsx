"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BookOpen, HeartHandshake, Inbox, Settings2, Users } from "./icons";
import { ArrowUpRight, LogOut, UserRound } from "lucide-react";

const mainNav = [
  { href: "/", label: "Today", icon: Inbox },
  { href: "/people", label: "People", icon: Users },
  { href: "/api-docs", label: "Agent API", icon: BookOpen },
];

const mobileNav = [...mainNav, { href: "/settings", label: "Settings", icon: Settings2 }];

function SignOut({ compact = false }: { compact?: boolean }) {
  return <form action="/api/auth/logout" method="post">
    <button className={compact ? "mobile-signout" : "sidebar-signout"} type="submit" aria-label="Sign out of Kinship">
      <LogOut size={16} aria-hidden="true" />
      {!compact && <span>Sign out</span>}
    </button>
  </form>;
}

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) => href === "/" ? pathname === "/" : pathname.startsWith(href);
  const currentPage = pathname.startsWith("/people") ? "People" : pathname.startsWith("/api-docs") ? "Agent API" : pathname.startsWith("/settings") ? "Settings" : pathname.startsWith("/onboarding") || pathname.startsWith("/import") ? "Import" : pathname.startsWith("/welcome") ? "Welcome" : "Today";

  return <div className="app-frame">
    <a className="app-skip-link" href="#main-content">Skip to content</a>
    <aside className="app-sidebar" aria-label="Workspace sidebar">
      <div className="sidebar-top">
        <Link href="/" className="brand" aria-label="Kinship home">
          <span className="brand-mark" aria-hidden="true"><HeartHandshake size={18} strokeWidth={1.9} /></span>
          <span className="brand-name">Kinship</span>
        </Link>
        <div className="sidebar-workspace"><span className="workspace-symbol" aria-hidden="true"><UserRound size={17} /></span><span><strong>Personal space</strong><small>Your relationship desk</small></span></div>
        <span className="sidebar-label">Workspace</span>
        <nav className="desktop-nav" aria-label="Primary navigation">
          {mainNav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`nav-link ${isActive(href) ? "is-active" : ""}`} aria-current={isActive(href) ? "page" : undefined}>
            <Icon size={17} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span>
          </Link>)}
        </nav>
      </div>
      <div className="sidebar-bottom">
        <div className="sidebar-note"><span className="sidebar-note-dot" aria-hidden="true" /><strong>Stay in touch, naturally.</strong><p>A little context makes every conversation easier.</p></div>
        <Link href="/settings" className={`nav-link sidebar-settings ${isActive("/settings") ? "is-active" : ""}`} aria-current={isActive("/settings") ? "page" : undefined}><Settings2 size={17} strokeWidth={1.8} aria-hidden="true" /><span>Settings</span></Link>
        <SignOut />
      </div>
    </aside>

    <div className="app-main-column">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="topbar-mobile-brand" aria-label="Kinship home"><span className="brand-mark" aria-hidden="true"><HeartHandshake size={17} /></span><strong>Kinship</strong></Link>
          <div className="topbar-breadcrumb"><span>Workspace</span><span aria-hidden="true">/</span><strong>{currentPage}</strong></div>
          <div className="topbar-meta"><span className="status-dot" aria-hidden="true" /><span className="status-label">Private workspace</span><Link href="/developers" className="topbar-guide">API guide <ArrowUpRight size={13} aria-hidden="true" /></Link><SignOut compact /></div>
        </div>
      </header>

      <main className="app-content" id="main-content">{children}</main>
    </div>

    <nav className="mobile-nav" aria-label="Mobile navigation">
      {mobileNav.map(({ href, label, icon: Icon }) => <Link key={href} href={href} className={`mobile-nav-link ${isActive(href) ? "is-active" : ""}`} aria-current={isActive(href) ? "page" : undefined}><Icon size={19} strokeWidth={1.8} aria-hidden="true" /><span>{label}</span></Link>)}
    </nav>
  </div>;
}
