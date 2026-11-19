"use client";

import { useEffect } from "react";
import { Button } from "@/components/ui";

export default function GlobalError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-4)",
        minHeight: "60vh",
        textAlign: "center",
        padding: "var(--space-6)",
      }}
    >
      <div style={{ fontSize: "var(--font-size-2xl)", fontWeight: 700 }}>Something went wrong</div>
      <p style={{ color: "var(--color-text-secondary)", maxWidth: 420 }}>
        We hit an unexpected error loading this page. You can try again, or head back to your dashboard.
      </p>
      <div style={{ display: "flex", gap: "var(--space-3)" }}>
        <Button variant="secondary" onClick={() => (window.location.href = "/dashboard")}>
          Go to dashboard
        </Button>
        <Button onClick={reset}>Try again</Button>
      </div>
    </div>
  );
}
