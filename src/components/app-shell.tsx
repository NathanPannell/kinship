"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { ReactNode } from "react";
import { BookOpen, FileUp, HeartHandshake, Inbox, Users } from "./icons";

const navItems = [
  { href: "/", label: "Today", icon: Inbox },
  { href: "/people", label: "People", icon: Users },
  { href: "/onboarding", label: "Import", icon: FileUp },
  { href: "/api-docs", label: "API", icon: BookOpen },
];

export function AppShell({ children }: { children: ReactNode }) {
  const pathname = usePathname();
  const isActive = (href: string) =>
    href === "/" ? pathname === "/" : pathname.startsWith(href);

  return (
    <div className="app-frame">
      <header className="topbar">
        <div className="topbar-inner">
          <Link href="/" className="brand" aria-label="Home">
            <span className="brand-mark" aria-hidden="true">
              <HeartHandshake size={17} strokeWidth={1.8} />
            </span>
            <span className="brand-name">Kinship</span>
          </Link>

          <nav className="desktop-nav" aria-label="Primary navigation">
            {navItems.map(({ href, label, icon: Icon }) => (
              <Link
                key={href}
                href={href}
                className={`nav-link ${isActive(href) ? "is-active" : ""}`}
                aria-current={isActive(href) ? "page" : undefined}
              >
                <Icon size={16} strokeWidth={1.8} aria-hidden="true" />
                {label}
              </Link>
            ))}
          </nav>

          <div className="topbar-meta">
            <span className="status-dot" aria-hidden="true" />
            <span className="status-label">Personal space</span>
            <span className="user-avatar" aria-hidden="true">N</span>
          </div>
        </div>
      </header>

      <main className="app-content">{children}</main>

      <nav className="mobile-nav" aria-label="Mobile navigation">
        {navItems.map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={`mobile-nav-link ${isActive(href) ? "is-active" : ""}`}
            aria-current={isActive(href) ? "page" : undefined}
          >
            <Icon size={20} strokeWidth={1.8} aria-hidden="true" />
            <span>{label}</span>
          </Link>
        ))}
      </nav>
    </div>
  );
}
