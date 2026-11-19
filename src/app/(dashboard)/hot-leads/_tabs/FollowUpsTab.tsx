"use client";

import { useState } from "react";
import { copyText } from "@/lib/utils/browser";
import { followUpsApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { useToast } from "@/context/ToastContext";
import { Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { TagChipList } from "@/components/features/hot-leads/TagChipList";
import { BellIcon } from "@/components/layout/icons";
import styles from "../page.module.scss";

export function FollowUpsTab({ businessId }: { businessId: string }) {
  const { show } = useToast();
  const [busyId, setBusyId] = useState<string | null>(null);

  const { data: followUps, refresh } = useAsync(
    () => followUpsApi.list(businessId),
    [businessId]
  );

  async function handleAction(id: string, status: "completed" | "dismissed") {
    setBusyId(id);
    try {
      await followUpsApi.updateStatus(businessId, id, status);
      show(status === "completed" ? "Marked as sent." : "Dismissed.", "default");
      refresh();
    } catch {
      show("Couldn't update this follow-up. Please try again.", "error");
    } finally {
      setBusyId(null);
    }
  }

  async function copyToClipboard(text: string) {
    try {
      await copyText(text);
      show("Copied to clipboard.", "default");
    } catch {
      show("Couldn't copy, please select and copy manually.", "error");
    }
  }

  const pending = (followUps ?? []).filter((f) => f.status === "pending");

  if (!followUps) {
    return (
      <div className={styles.list}>
        <Skeleton height={140} />
        <Skeleton height={140} />
      </div>
    );
  }

  if (pending.length === 0) {
    return <EmptyState icon={<BellIcon size={24} />} title="No follow-ups pending" description="You're all caught up." />;
  }

  return (
    <div className={styles.list}>
      {pending.map((f) => (
        <Card key={f.id} className={styles.card}>
          <div className={styles.topRow}>
            <span className={styles.customerName}>{f.customer?.name ?? f.customer?.phone ?? "Customer"}</span>
            {f.reason && <span className={styles.reason}>{f.reason}</span>}
          </div>
          {f.customer?.tags && f.customer.tags.length > 0 && <TagChipList tags={f.customer.tags} />}
          <div className={styles.draftBox}>{f.suggested_message}</div>
          <div className={styles.actions}>
            <span className={styles.copyHint} style={{ marginRight: "auto", alignSelf: "center" }}>
              Copy this and send it on WhatsApp
            </span>
            <Button variant="secondary" size="sm" onClick={() => copyToClipboard(f.suggested_message)}>
              Copy
            </Button>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => handleAction(f.id, "dismissed")}
              disabled={busyId === f.id}
            >
              Dismiss
            </Button>
            <Button size="sm" onClick={() => handleAction(f.id, "completed")} isLoading={busyId === f.id}>
              Mark as sent
            </Button>
          </div>
        </Card>
      ))}
    </div>
  );
}
