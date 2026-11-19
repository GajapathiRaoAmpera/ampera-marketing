"use client";

import { Fragment, useEffect, useState, type ReactNode } from "react";
import clsx from "clsx";
import { Sidebar } from "./Sidebar";
import { Topbar } from "./Topbar";
import { EmailVerificationBanner } from "./EmailVerificationBanner";
import { AccountStatusBanner } from "./AccountStatusBanner";
import { useBusiness } from "@/context/BusinessContext";
import styles from "./DashboardShell.module.scss";

const SIDEBAR_COLLAPSE_STORAGE_KEY = "sidebar-collapsed";

export function DashboardShell({ children }: { children: ReactNode }) {
  const { activeBusiness } = useBusiness();
  const [isSidebarOpen, setIsSidebarOpen] = useState(false);
  // Owned here (not inside Sidebar) so .main's left padding can react to it
  // too - the fixed-position sidebar's width and the content area's offset
  // have to move together. Starts false on every render (server and first
  // client paint) so hydration markup matches; the saved preference applies
  // right after mount, since localStorage doesn't exist during SSR.
  const [isSidebarCollapsed, setIsSidebarCollapsed] = useState(false);

  useEffect(() => {
    try {
      if (localStorage.getItem(SIDEBAR_COLLAPSE_STORAGE_KEY) === "true") setIsSidebarCollapsed(true);
    } catch {
      // Private browsing / storage disabled: default (expanded) stands.
    }
  }, []);

  function toggleSidebarCollapsed() {
    setIsSidebarCollapsed((current) => {
      const next = !current;
      try {
        localStorage.setItem(SIDEBAR_COLLAPSE_STORAGE_KEY, String(next));
      } catch {
        // Nothing to persist to; the in-memory toggle for this session still works.
      }
      return next;
    });
  }

  return (
    <>
      <Sidebar
        isOpen={isSidebarOpen}
        onClose={() => setIsSidebarOpen(false)}
        isCollapsed={isSidebarCollapsed}
        onToggleCollapsed={toggleSidebarCollapsed}
      />
      <div className={clsx(styles.main, isSidebarCollapsed && styles.mainCollapsed)}>
        <Topbar onMenuClick={() => setIsSidebarOpen(true)} />
        <EmailVerificationBanner />
        <AccountStatusBanner />
        {/* Keyed by business: switching to a business with a different owner remounts
            the page so everything refetches with the new X-Business-Id. */}
        <div className={styles.content}>
          <div className={styles.inner}>
            <Fragment key={activeBusiness?.id ?? "none"}>{children}</Fragment>
          </div>
        </div>
      </div>
    </>
  );
}
