import Link from "next/link";
import type { ReactNode } from "react";
import clsx from "clsx";
import type { AdminUser, TierId, UsageMeter } from "@/lib/api";
import styles from "./AdminUi.module.scss";

export const TIER_NAME: Record<TierId, string> = {
  trial: "Trial",
  free: "Free",
  pro: "Pro",
  enterprise: "Enterprise",
  expired: "Trial ended",
};

export function formatDate(value: string | null | undefined): string {
  if (!value) return "-";
  return new Date(value).toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function timeAgo(value: string | null | undefined): string {
  if (!value) return "-";
  const seconds = Math.max(0, Math.round((Date.now() - new Date(value).getTime()) / 1000));
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 48) return `${hours} h ago`;
  return `${Math.round(hours / 24)} days ago`;
}

export function PageHeader({
  title,
  description,
  actions,
  onBack,
  backLabel = "Back",
}: {
  title: ReactNode;
  description?: ReactNode;
  actions?: ReactNode;
  onBack?: () => void;
  backLabel?: string;
}) {
  return (
    <div className={styles.pageHeader}>
      <div className={styles.pageHeaderText}>
        {onBack && (
          <button type="button" className={styles.back} onClick={onBack}>
            <span aria-hidden>←</span> {backLabel}
          </button>
        )}
        <h1 className={styles.pageTitle}>{title}</h1>
        {description && <p className={styles.pageDescription}>{description}</p>}
      </div>
      {actions && <div className={styles.pageActions}>{actions}</div>}
    </div>
  );
}

export function StatGrid({ children }: { children: ReactNode }) {
  return <div className={styles.statGrid}>{children}</div>;
}

export function StatCard({
  label,
  value,
  hint,
  href,
  tone,
}: {
  label: string;
  value: ReactNode;
  hint?: ReactNode;
  href?: string;
  tone?: "warning" | "danger";
}) {
  const className = clsx(
    styles.stat,
    href && styles.statLink,
    tone === "warning" && styles.toneWarning,
    tone === "danger" && styles.toneDanger
  );
  const body = (
    <>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value}</span>
      {hint && <span className={styles.statHint}>{hint}</span>}
    </>
  );
  return href ? (
    <Link href={href} className={className}>
      {body}
    </Link>
  ) : (
    <div className={className}>{body}</div>
  );
}

export function Panel({
  title,
  description,
  action,
  flush,
  children,
}: {
  title?: ReactNode;
  description?: ReactNode;
  action?: ReactNode;
  flush?: boolean;
  children: ReactNode;
}) {
  return (
    <section className={styles.panel}>
      {(title || action) && (
        <div className={styles.panelHead}>
          <div>
            {title && <h2 className={styles.panelTitle}>{title}</h2>}
            {description && <p className={styles.panelDescription}>{description}</p>}
          </div>
          {action}
        </div>
      )}
      <div className={clsx(styles.panelBody, flush && styles.panelFlush)}>{children}</div>
    </section>
  );
}

/** Where an account is in the approval flow, in plain words. */
export function AccountStatusPill({ user }: { user: Pick<AdminUser, "approval_status" | "disabled"> }) {
  if (user.disabled) {
    return <span className={clsx(styles.pill, styles.pillPaused)}>Paused</span>;
  }
  if (user.approval_status === "pending") {
    return (
      <span className={clsx(styles.pill, styles.pillPending)}>
        <span className={styles.pillDot} /> Awaiting approval
      </span>
    );
  }
  return (
    <span className={clsx(styles.pill, styles.pillActive)}>
      <span className={styles.pillDot} /> Active
    </span>
  );
}

export function TierPill({ tier }: { tier: TierId }) {
  return (
    <span
      className={clsx(
        styles.pill,
        (tier === "trial" || tier === "expired") && styles.pillPending,
        tier === "free" && styles.pillNeutral,
        tier === "pro" && styles.pillBrand,
        tier === "enterprise" && styles.pillInfo
      )}
    >
      {TIER_NAME[tier] ?? tier}
    </span>
  );
}

export function Pill({ children, tone = "neutral" }: { children: ReactNode; tone?: "neutral" | "brand" | "info" | "active" | "pending" }) {
  return (
    <span
      className={clsx(
        styles.pill,
        tone === "neutral" && styles.pillNeutral,
        tone === "brand" && styles.pillBrand,
        tone === "info" && styles.pillInfo,
        tone === "active" && styles.pillActive,
        tone === "pending" && styles.pillPending
      )}
    >
      {children}
    </span>
  );
}

/** A used-versus-allowed bar that says what it means, including "no limit". */
export function Meter({ label, meter, note }: { label: string; meter: UsageMeter; note?: string }) {
  const unlimited = meter.limit === null;
  const pct = unlimited || !meter.limit ? 0 : Math.min(100, Math.round((meter.used / meter.limit) * 100));
  const when = meter.lifetime ? "for life" : "this month";
  return (
    <div className={styles.meter}>
      <div className={styles.meterTop}>
        <span className={styles.meterLabel}>{label}</span>
        <span className={styles.meterValue}>
          {unlimited ? (
            <>{meter.used.toLocaleString()} used · no limit</>
          ) : (
            <>
              {meter.used.toLocaleString()} of {meter.limit?.toLocaleString()} used {when}
            </>
          )}
        </span>
      </div>
      <div className={styles.meterTrack} role="progressbar" aria-valuemin={0} aria-valuemax={meter.limit ?? undefined} aria-valuenow={meter.used}>
        <div
          className={clsx(
            styles.meterFill,
            unlimited && styles.meterUnlimited,
            pct >= 100 && styles.meterFull,
            pct >= 80 && pct < 100 && styles.meterWarn
          )}
          style={{ width: unlimited ? "100%" : `${pct}%` }}
        />
      </div>
      {note && <span className={styles.meterNote}>{note}</span>}
    </div>
  );
}

export function Identity({ name, email, extra }: { name: string | null; email: string | null; extra?: ReactNode }) {
  const initial = (name || email || "?").trim().charAt(0).toUpperCase();
  return (
    <div className={styles.identity}>
      <span className={styles.initial} aria-hidden>
        {initial}
      </span>
      <div className={styles.identityText}>
        <div className={styles.identityName}>{name || email || "Unnamed account"}</div>
        <div className={styles.identityMeta}>{name ? email : null}</div>
        {extra}
      </div>
    </div>
  );
}

export { styles as adminStyles };
