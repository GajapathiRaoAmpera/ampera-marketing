import Link from "next/link";
import { Button } from "@/components/ui";

export default function NotFound() {
  return (
    <div
      style={{
        display: "flex",
        flexDirection: "column",
        alignItems: "center",
        justifyContent: "center",
        gap: "var(--space-4)",
        minHeight: "100dvh",
        textAlign: "center",
        padding: "var(--space-6)",
      }}
    >
      <div style={{ fontSize: "var(--font-size-4xl)", fontWeight: 700, color: "var(--color-brand-500)" }}>404</div>
      <div style={{ fontSize: "var(--font-size-xl)", fontWeight: 600 }}>Page not found</div>
      <p style={{ color: "var(--color-text-secondary)", maxWidth: 380 }}>
        The page you're looking for doesn't exist or may have moved.
      </p>
      <Link href="/dashboard">
        <Button>Back to dashboard</Button>
      </Link>
    </div>
  );
}
