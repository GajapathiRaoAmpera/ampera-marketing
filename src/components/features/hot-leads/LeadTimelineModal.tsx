"use client";

import { useState } from "react";
import clsx from "clsx";
import { conversationsApi, hotLeadsApi, ApiError } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useAuth } from "@/context/AuthContext";
import { useToast } from "@/context/ToastContext";
import { formatShortDateTime } from "@/lib/utils/date";
import { EmptyState, Modal, Skeleton, Tabs } from "@/components/ui";
import { MessageBubble } from "@/components/features/inbox/MessageBubble";
import { TagsNotesEditor } from "./TagsNotesEditor";
import type { HotLead } from "@/types/api";
import styles from "../../../app/(dashboard)/hot-leads/page.module.scss";

function humanizeSignal(signal: string): string {
  return signal.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

type DetailTab = "details" | "messages" | "timeline";

const TABS: { value: DetailTab; label: string }[] = [
  { value: "details", label: "Details" },
  { value: "messages", label: "Messages" },
  { value: "timeline", label: "Score timeline" },
];

function MessagesPanel({ conversationKey }: { conversationKey: string }) {
  const { data, isLoading } = useAsync(
    () => conversationsApi.messages(conversationKey, { limit: 50 }),
    [conversationKey]
  );

  if (isLoading) {
    return (
      <div className={styles.messagesPanelSkeleton}>
        <Skeleton height={40} width="55%" />
        <Skeleton height={40} width="40%" />
        <Skeleton height={40} width="60%" />
      </div>
    );
  }

  if (!data || data.messages.length === 0) {
    return <EmptyState title="No messages yet" description="Messages will appear here once this conversation starts." />;
  }

  return (
    <div className={styles.messagesPanel}>
      {data.messages.map((message) => (
        <MessageBubble key={message.id} message={message} />
      ))}
      {data.hasMore && <div className={styles.messagesPanelMore}>Showing the most recent {data.messages.length} messages.</div>}
    </div>
  );
}

export function LeadTimelineModal({
  businessId,
  lead,
  onClose,
  onLeadUpdated,
}: {
  businessId: string;
  lead: HotLead | null;
  onClose: () => void;
  // Called after a successful tag/note save so the caller can re-fetch the
  // list behind this modal - otherwise the card grid (and its TagChipList)
  // would keep showing stale tags until some unrelated refresh happened to
  // fire.
  onLeadUpdated?: () => void;
}) {
  const { user } = useAuth();
  const { show } = useToast();
  const [tab, setTab] = useState<DetailTab>("details");

  const { data: timelineData, isLoading: isTimelineLoading } = useAsync(
    () => (lead && tab === "timeline" ? hotLeadsApi.timeline(businessId, lead.customer_id) : Promise.resolve(null)),
    [businessId, lead?.customer_id, tab]
  );

  const conversationKey = lead?.conversation?.conversation_key;

  async function handleSave(input: { tags?: string[]; notes?: string }) {
    if (!conversationKey) return;
    try {
      await conversationsApi.updateCustomer(businessId, conversationKey, input);
      onLeadUpdated?.();
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't save. Please try again.", "error");
    }
  }

  function handleClose() {
    setTab("details");
    onClose();
  }

  return (
    <Modal isOpen={Boolean(lead)} onClose={handleClose} title={lead ? lead.name ?? lead.phone ?? "Lead" : ""} size="xl">
      {lead && (
        <>
          <Tabs options={TABS} value={tab} onChange={setTab} variant="underline" />
          <div className={styles.tabPanelInModal}>
            {tab === "details" && (
              conversationKey ? (
                <TagsNotesEditor tags={lead.tags} notes={lead.notes} onSave={handleSave} />
              ) : (
                <div className={styles.tagsUnavailable}>
                  Tags and notes aren&apos;t available for this lead yet (no conversation on record).
                </div>
              )
            )}

            {tab === "messages" && (
              conversationKey ? (
                <MessagesPanel conversationKey={conversationKey} />
              ) : (
                <EmptyState title="No conversation yet" description="This customer hasn't started a conversation yet." />
              )
            )}

            {tab === "timeline" && (
              isTimelineLoading ? (
                <Skeleton height={240} />
              ) : !timelineData || timelineData.timeline.length === 0 ? (
                <EmptyState title="No signals yet" description="Activity will appear here as this lead engages." />
              ) : (
                <div className={styles.timeline}>
                  {timelineData.timeline.map((entry, i) => (
                    <div key={i} className={styles.timelineItem}>
                      <span className={styles.timelineDot} />
                      <div className={styles.timelineBody}>
                        <div className={styles.timelineSignal}>
                          {humanizeSignal(entry.signal)}{" "}
                          <span className={clsx(styles.timelineDelta, entry.delta >= 0 ? styles.deltaPositive : styles.deltaNegative)}>
                            {entry.delta >= 0 ? "+" : ""}
                            {entry.delta}
                          </span>
                        </div>
                        <div className={styles.timelineMeta}>
                          {formatShortDateTime(entry.timestamp, user?.timezone)} · Score: {entry.resulting_score}
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )
            )}
          </div>
        </>
      )}
    </Modal>
  );
}
