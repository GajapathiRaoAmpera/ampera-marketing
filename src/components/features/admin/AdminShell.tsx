"use client";

import { useEffect, useState, type ReactNode } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import clsx from "clsx";
import { adminApi } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { HomeIcon, LogoutIcon, MenuIcon, SettingsIcon, UsersIcon } from "@/components/layout/icons";
import styles from "./AdminShell.module.scss";

function CheckCircleIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <circle cx="12" cy="12" r="9" />
      <path d="M8 12.5l3 3 5-6" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden>
      <path d="M10 6l-6 6 6 6M4 12h16" />
    </svg>
  );
}

interface NavItem {
  href: string;
  label: string;
  icon: ReactNode;
  badge?: number;
  match: (path: string) => boolean;
}

export function AdminShell({ email, children }: { email: string; children: ReactNode }) {
  const pathname = usePathname();
  const { logout } = useAuth();
  const [isOpen, setIsOpen] = useState(false);
  const [pending, setPending] = useState(0);

  // How many accounts are waiting, for the badge. Refreshed on every page
  // change, so approving someone updates it without a reload.
  useEffect(() => {
    let cancelled = false;
    adminApi
      .listUsers(0, 1, undefined, "pending")
      .then((result) => {
        if (!cancelled) setPending(result.total);
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [pathname]);

  const items: NavItem[] = [
    { href: "/admin", label: "Overview", icon: <HomeIcon />, match: (p) => p === "/admin" },
    {
      href: "/admin/approvals", label: "Approvals", icon: <CheckCircleIcon />, badge: pending,
      match: (p) => p.startsWith("/admin/approvals"),
    },
    {
      href: "/admin/users", label: "Accounts", icon: <UsersIcon />,
      match: (p) => p.startsWith("/admin/users") || p.startsWith("/admin/businesses"),
    },
    { href: "/admin/settings", label: "Plans & limits", icon: <SettingsIcon />, match: (p) => p.startsWith("/admin/settings") },
  ];
  const current = items.find((item) => item.match(pathname));

  return (
    <div className={styles.shell}>
      {isOpen && <div className={styles.scrim} onClick={() => setIsOpen(false)} aria-hidden />}

      <aside className={clsx(styles.sidebar, isOpen && styles.sidebarOpen)} aria-label="Admin navigation">
        <div className={styles.brand}>
          <span className={styles.brandMark} aria-hidden>
            A
          </span>
          <div>
            <div className={styles.brandName}>Admin</div>
            <div className={styles.brandSub}>Platform control</div>
          </div>
        </div>

        <nav className={styles.nav}>
          <div className={styles.navLabel}>Manage</div>
          {items.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className={clsx(styles.navLink, item.match(pathname) && styles.navActive)}
              onClick={() => setIsOpen(false)}
              aria-current={item.match(pathname) ? "page" : undefined}
            >
              <span className={styles.navIcon}>{item.icon}</span>
              <span className={styles.navText}>{item.label}</span>
              {item.badge ? <span className={styles.badge}>{item.badge > 99 ? "99+" : item.badge}</span> : null}
            </Link>
          ))}
        </nav>

        <div className={styles.foot}>
          <div className={styles.signedIn}>Signed in as {email}</div>
          <Link href="/dashboard" className={styles.footButton} onClick={() => setIsOpen(false)}>
            <BackIcon /> Back to the app
          </Link>
          <button type="button" className={styles.footButton} onClick={() => logout()}>
            <LogoutIcon size={18} /> Sign out
          </button>
        </div>
      </aside>

      <div className={styles.main}>
        <header className={styles.mobileBar}>
          <button type="button" className={styles.menuButton} onClick={() => setIsOpen(true)} aria-label="Open admin menu">
            <MenuIcon />
          </button>
          <span className={styles.mobileTitle}>{current?.label ?? "Admin"}</span>
          {pending > 0 && <span className={styles.badge}>{pending}</span>}
        </header>
        <main className={styles.content}>{children}</main>
      </div>
    </div>
  );
}
