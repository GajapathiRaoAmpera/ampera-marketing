"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import styles from "./error.module.scss";

/**
 * Route-group error boundary for everything under (dashboard).
 *
 * Without this, an uncaught render error inside a single feature page (e.g.
 * Campaigns, Forms, Flow builder) bubbles past the dashboard shell entirely
 * and is caught by the ROOT error.tsx instead, which throws away the
 * sidebar/topbar too, so the user loses the whole app instead of just the
 * one broken panel. This file keeps that blast radius to the page itself:
 * the shell (sidebar/topbar/business switcher) stays mounted and usable,
 * and the user can navigate away without a full reload.
 */
export default function DashboardError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[dashboard]", error);
  }, [error]);

  return (
    <div className={styles.wrap}>
      <div className={styles.title}>This page hit a snag</div>
      <p className={styles.description}>
        Something went wrong loading this section. Your other pages are unaffected, try again, or head back to the
        dashboard.
      </p>
      <div className={styles.actions}>
        <Link href="/dashboard">
          <Button variant="secondary">Back to dashboard</Button>
        </Link>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
