"use client";

import Link from "next/link";
import { useState } from "react";
import { Button, Card, Skeleton } from "@/components/ui";
import { whatsappStudioApi, whatsappTemplatesApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useActiveBusiness } from "@/lib/hooks/useActiveBusiness";
import { TemplateIcon } from "@/components/layout/icons";
import { TemplateCreateForm } from "@/components/features/whatsapp/TemplateCreateForm";
import { TemplateList } from "@/components/features/whatsapp/TemplateList";
import whatsappPageStyles from "../page.module.scss";
import styles from "./page.module.scss";

type View = "list" | "create";

export default function WhatsAppTemplatesPage() {
  const [view, setView] = useState<View>("list");
  const { businessId } = useActiveBusiness();
  const { data: stats, isLoading: statsLoading, refresh: refreshStats } = useAsync(
    () => businessId ? whatsappTemplatesApi.stats(businessId) : Promise.resolve(null), [businessId]
  );
  const { data: overview, isLoading: connectionsLoading } = useAsync(
    () => businessId ? whatsappStudioApi.overview(businessId) : Promise.resolve(null), [businessId]
  );
  const hasConnection = !connectionsLoading && (overview?.counts.whatsapp_accounts ?? 0) > 0;

  function handleCreated() {
    setView("list");
    refreshStats();
  }

  return (
    <div>
      <div className={whatsappPageStyles.header}>
        <div className={whatsappPageStyles.iconBadge}>
          <TemplateIcon size={24} />
        </div>
        <div className={styles.headerText}>
          <div className={whatsappPageStyles.title}>WhatsApp Templates</div>
          <div className={whatsappPageStyles.subtitle}>
            Create, preview, and manage message templates for marketing, utility, and authentication messages.
          </div>
        </div>
        {view === "list" && (
          <Button onClick={() => setView("create")} className={styles.createButton} disabled={!hasConnection}>
            + New template
          </Button>
        )}
        {view === "create" && (
          <Button variant="secondary" onClick={() => setView("list")} className={styles.createButton}>
            Back to list
          </Button>
        )}
      </div>

      {!connectionsLoading && !hasConnection && (
        <Card className={styles.connectionWarning}>
          <div className={styles.connectionWarningTitle}>Connect WhatsApp to create templates</div>
          <div className={styles.connectionWarningBody}>
            You&apos;ll need a connected WhatsApp Business account before Meta will accept template submissions.
          </div>
          <Link href="/channels/whatsapp">
            <Button variant="secondary">Go to WhatsApp connection</Button>
          </Link>
        </Card>
      )}

      {view === "list" && (
        <>
          {statsLoading ? (
            <Skeleton height={80} />
          ) : stats ? (
            <div className={styles.statsRow}>
              <Card padding="sm" className={styles.statCard}>
                <div className={styles.statValue}>{stats.total}</div>
                <div className={styles.statLabel}>Total</div>
              </Card>
              <Card padding="sm" className={styles.statCard}>
                <div className={styles.statValue} data-tone="success">
                  {stats.approved}
                </div>
                <div className={styles.statLabel}>Approved</div>
              </Card>
              <Card padding="sm" className={styles.statCard}>
                <div className={styles.statValue} data-tone="warning">
                  {stats.pending}
                </div>
                <div className={styles.statLabel}>Pending</div>
              </Card>
              <Card padding="sm" className={styles.statCard}>
                <div className={styles.statValue} data-tone="danger">
                  {stats.rejected}
                </div>
                <div className={styles.statLabel}>Rejected</div>
              </Card>
            </div>
          ) : null}

          {businessId && <TemplateList businessId={businessId} onMutated={refreshStats} />}
        </>
      )}

      {view === "create" && businessId && <TemplateCreateForm businessId={businessId} onCreated={handleCreated} />}
    </div>
  );
}
