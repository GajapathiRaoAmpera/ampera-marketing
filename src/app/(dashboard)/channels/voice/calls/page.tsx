"use client";

import { EmptyState, Skeleton } from "@/components/ui";
import { PhoneIcon } from "@/components/layout/icons";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { CallsTab } from "@/components/features/voice/CallsTab";
import styles from "./page.module.scss";

export default function VoiceCallLogPage() {
  const { isLoading, hasNoBusinesses } = useActiveBusiness();

  if (isLoading) return <Skeleton height={320} />;
  if (hasNoBusinesses) {
    return <EmptyState title="Create a business first" description="You'll need a business set up before you can see call history." />;
  }

  return (
    <div>
      <div className={styles.header}>
        <div className={styles.iconBadge}>
          <PhoneIcon size={24} />
        </div>
        <div>
          <div className={styles.title}>Call history</div>
          <div className={styles.subtitle}>Every call with its outcome. Search, filter, star the ones that matter, or call someone back.</div>
        </div>
      </div>
      <CallsTab />
    </div>
  );
}
