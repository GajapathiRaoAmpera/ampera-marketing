"use client";

import Link from "next/link";
import { useCallback, useEffect, useState } from "react";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { voiceCallsApi, type VoiceStatus } from "@/lib/api";
import { EmptyState, Skeleton } from "@/components/ui";
import { PhoneIcon } from "@/components/layout/icons";
import { NumberSetup } from "@/components/features/voice/NumberSetup";
import styles from "../page.module.scss";
import { useEmbedded } from "@/components/layout/Embedded";

export default function VoiceNumberPage() {
  const embedded = useEmbedded();
  const { business, businessId, isLoading, hasNoBusinesses } = useActiveBusiness();
  const [status, setStatus] = useState<VoiceStatus | null>(null);
  const [isStatusLoading, setIsStatusLoading] = useState(true);

  const loadStatus = useCallback(() => {
    voiceCallsApi
      .status()
      .then(setStatus)
      .catch(() => setStatus({ connected: false }))
      .finally(() => setIsStatusLoading(false));
  }, []);

  useEffect(() => {
    loadStatus();
  }, [loadStatus]);

  return (
    <div style={{ maxWidth: 820 }}>
      {!embedded && (
        <div className={styles.header}>
          <div className={styles.iconBadge}>
            <PhoneIcon size={24} />
          </div>
          <div>
            <div className={styles.title}>Phone number</div>
            <div className={styles.subtitle}>
              The number your AI agent answers and calls from. <Link href="/channels/voice">Back to call center</Link>
            </div>
          </div>
        </div>
      )}

      {isLoading || isStatusLoading ? (
        <Skeleton height={360} />
      ) : hasNoBusinesses || !businessId ? (
        <EmptyState title="Create a business first" description="You'll need a business set up before you can connect a phone number." />
      ) : (
        <NumberSetup status={status} agentId={business?.agent_id} onChanged={loadStatus} />
      )}
    </div>
  );
}
