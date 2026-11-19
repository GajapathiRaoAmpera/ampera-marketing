"use client";

import { useState } from "react";
import clsx from "clsx";
import { hotLeadsApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { Card, EmptyState, Skeleton } from "@/components/ui";
import { LeadTimelineModal } from "@/components/features/hot-leads/LeadTimelineModal";
import { TagChipList } from "@/components/features/hot-leads/TagChipList";
import { FireIcon } from "@/components/layout/icons";
import type { HotLead } from "@/types/api";
import styles from "../page.module.scss";

type MinLabel = "hot" | "very_hot" | undefined;

const FILTERS: { value: MinLabel; label: string }[] = [
  { value: undefined, label: "All warm+" },
  { value: "hot", label: "Hot" },
  { value: "very_hot", label: "Very hot" },
];

export function HotLeadsTab({ businessId }: { businessId: string }) {
  const [filter, setFilter] = useState<MinLabel>(undefined);
  const [selectedLead, setSelectedLead] = useState<HotLead | null>(null);

  const { data: leads, isLoading, refresh } = useAsync(
    () => hotLeadsApi.list(businessId, filter),
    [businessId, filter]
  );

  return (
    <div>
      <div className={styles.filterRow}>
        {FILTERS.map((f) => (
          <button
            key={f.label}
            type="button"
            className={clsx(styles.filterChip, filter === f.value && styles.filterChipActive)}
            onClick={() => setFilter(f.value)}
          >
            {f.label}
          </button>
        ))}
      </div>

      {isLoading ? (
        <div className={styles.grid}>
          <Skeleton height={140} />
          <Skeleton height={140} />
          <Skeleton height={140} />
        </div>
      ) : !leads || leads.length === 0 ? (
        <EmptyState
          icon={<FireIcon size={24} />}
          title="No hot leads right now"
          description="As customers engage more, high-intent leads will show up here automatically."
        />
      ) : (
        <div className={styles.grid}>
          {leads.map((lead) => (
            <Card key={lead.customer_id} className={styles.leadCard} interactive onClick={() => setSelectedLead(lead)}>
              <div className={styles.leadTop}>
                <div>
                  <div className={styles.leadName}>{lead.name ?? lead.phone ?? "Unknown"}</div>
                  {lead.phone && <div className={styles.leadPhone}>{lead.phone}</div>}
                </div>
                <span className={clsx(styles.scoreRing, lead.lead_status === "very_hot" ? styles.scoreVeryHot : styles.scoreHot)}>
                  {lead.lead_score}
                </span>
              </div>
              {lead.last_signal && <div className={styles.leadSignal}>Last: {lead.last_signal.replace(/_/g, " ")}</div>}
              {lead.tags.length > 0 && <TagChipList tags={lead.tags} />}
              {lead.notes && <div className={styles.leadNote}>{lead.notes}</div>}
            </Card>
          ))}
        </div>
      )}

      <LeadTimelineModal
        businessId={businessId}
        lead={selectedLead}
        onClose={() => setSelectedLead(null)}
        onLeadUpdated={refresh}
      />
    </div>
  );
}
