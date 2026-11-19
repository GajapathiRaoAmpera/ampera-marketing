"use client";

import type { ReactNode } from "react";
import { copyText } from "@/lib/utils/browser";
import { EmptyState, Skeleton } from "@/components/ui";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import pageStyles from "@/app/(dashboard)/channels/whatsapp/page.module.scss";
import hubStyles from "@/components/features/messenger/Messenger.module.scss";
import styles from "./ChannelFrame.module.scss";

interface ChannelFrameProps {
  title: string;
  subtitle: string;
  icon: ReactNode;
  /** Brand colour behind the icon. */
  color: string;
  /** Rendered once a business (and so an assistant to link) exists. */
  children: (agentId: string | undefined) => ReactNode;
}

/** Page header plus the "create a business first" guard shared by the Telegram, SMS and Discord pages. */
export function ChannelFrame({ title, subtitle, icon, color, children }: ChannelFrameProps) {
  const { business, businessId, isLoading, hasNoBusinesses } = useActiveBusiness();

  return (
    <div className={hubStyles.shell}>
      <div className={pageStyles.header}>
        <div className={pageStyles.iconBadge} style={{ background: color }}>{icon}</div>
        <div className={hubStyles.headerText}>
          <div className={pageStyles.title}>{title}</div>
          <div className={pageStyles.subtitle}>{subtitle}</div>
        </div>
      </div>

      {isLoading ? (
        <Skeleton height={320} />
      ) : hasNoBusinesses || !businessId ? (
        <EmptyState title="Create a business first" description={`You'll need a business set up before you can connect ${title}.`} />
      ) : (
        <div className={hubStyles.body}>{children((business?.agent_id as string | undefined) ?? undefined)}</div>
      )}
    </div>
  );
}

/** Numbered how-to list used on each channel's connect screen. */
export function SetupSteps({ steps }: { steps: ReactNode[] }) {
  return (
    <ol className={styles.steps}>
      {steps.map((step, index) => (
        <li key={index}>
          <span className={styles.stepNumber}>{index + 1}</span>
          <div>{step}</div>
        </li>
      ))}
    </ol>
  );
}

/** A value the user needs to copy somewhere else, with a copy button. */
export function CopyField({ label, value, onCopied }: { label: string; value: string; onCopied: () => void }) {
  return (
    <div className={styles.copyField}>
      <span className={styles.copyLabel}>{label}</span>
      <div className={styles.copyRow}>
        <code>{value}</code>
        <button type="button" className={hubStyles.linkButton} onClick={() => copyText(value).then(onCopied)}>
          Copy
        </button>
      </div>
    </div>
  );
}
