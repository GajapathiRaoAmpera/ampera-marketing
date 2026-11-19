"use client";

import { useEffect } from "react";
import Link from "next/link";
import { Button } from "@/components/ui";
import styles from "./error.module.scss";

/** Route-group error boundary for (admin), see (dashboard)/error.tsx for why this exists per-group. */
export default function AdminError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("[admin]", error);
  }, [error]);

  return (
    <div className={styles.wrap}>
      <div className={styles.title}>This page hit a snag</div>
      <p className={styles.description}>Something went wrong loading this section. Try again, or head back.</p>
      <div className={styles.actions}>
        <Link href="/admin">
          <Button variant="secondary">Back to admin home</Button>
        </Link>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
