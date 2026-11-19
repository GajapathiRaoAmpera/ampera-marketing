"use client";

import { useEffect, useState } from "react";
import clsx from "clsx";
import { hotLeadsApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { Card, EmptyState, Skeleton } from "@/components/ui";
import { FilterDropdown } from "@/components/features/inbox/FilterDropdown";
import { LeadTimelineModal } from "@/components/features/hot-leads/LeadTimelineModal";
import { TagChipList } from "@/components/features/hot-leads/TagChipList";
import { TagIcon } from "@/components/layout/icons";
import type { HotLead } from "@/types/api";
import styles from "../page.module.scss";

// Independent of AI lead scoring (see Hot Leads tab): this filters by the
// tags a user actually applies from the inbox/lead modal (TagsNotesEditor),
// so a customer never scored "hot" but manually tagged VIP/Ready to buy
// still shows up here - the gap the user pointed out ("still nothing is
// here" on Hot Leads, when what they wanted was to filter by their own tags).
export function TaggedTab({ businessId }: { businessId: string }) {
  const [selectedTag, setSelectedTag] = useState("");
  const [selectedLead, setSelectedLead] = useState<HotLead | null>(null);

  const { data: availableTags } = useAsync(() => hotLeadsApi.listTags(businessId), [businessId]);

  // Auto-select the first tag once the tag list loads, so a business with
  // exactly one tag in use doesn't land on an empty "pick a tag" screen for
  // no reason. Only runs while nothing's picked yet, so it never overrides
  // a deliberate later change back to "" if that ever becomes selectable.
  useEffect(() => {
    if (!selectedTag && availableTags && availableTags.length > 0) {
      setSelectedTag(availableTags[0]);
    }
  }, [availableTags, selectedTag]);

  const {
    data: customers,
    isLoading,
    refresh,
  } = useAsync(
    () => (selectedTag ? hotLeadsApi.listByTag(businessId, selectedTag) : Promise.resolve([])),
    [businessId, selectedTag]
  );

  if (!availableTags) {
    return (
      <div className={styles.grid}>
        <Skeleton height={140} />
        <Skeleton height={140} />
      </div>
    );
  }

  if (availableTags.length === 0) {
    return (
      <EmptyState
        icon={<TagIcon size={24} />}
        title="No tags yet"
        description="Add a tag to a customer from the inbox or a lead's detail view, then filter by it here."
      />
    );
  }

  return (
    <div>
      <div className={styles.filterRow}>
        <FilterDropdown
          options={availableTags.map((tag) => ({ value: tag, label: tag }))}
          value={selectedTag}
          onChange={setSelectedTag}
          placeholder="Choose a tag"
        />
      </div>

      {isLoading ? (
        <div className={styles.grid}>
          <Skeleton height={140} />
          <Skeleton height={140} />
        </div>
      ) : !customers || customers.length === 0 ? (
        <EmptyState
          icon={<TagIcon size={24} />}
          title={`No customers tagged "${selectedTag}"`}
          description="This tag isn't currently applied to anyone."
        />
      ) : (
        <div className={styles.grid}>
          {customers.map((customer) => (
            <Card
              key={customer.customer_id}
              className={styles.leadCard}
              interactive
              onClick={() => setSelectedLead(customer)}
            >
              <div className={styles.leadTop}>
                <div>
                  <div className={styles.leadName}>{customer.name ?? customer.phone ?? "Unknown"}</div>
                  {customer.phone && <div className={styles.leadPhone}>{customer.phone}</div>}
                </div>
                {customer.lead_status && (
                  <span
                    className={clsx(
                      styles.scoreRing,
                      customer.lead_status === "very_hot" ? styles.scoreVeryHot : styles.scoreHot
                    )}
                  >
                    {customer.lead_score}
                  </span>
                )}
              </div>
              <TagChipList tags={customer.tags} />
              {customer.notes && <div className={styles.leadNote}>{customer.notes}</div>}
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
