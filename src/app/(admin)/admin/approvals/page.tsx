"use client";

import { useState } from "react";
import Link from "next/link";
import { adminApi, type AdminUser } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { Badge, Button, Card, EmptyState, Skeleton } from "@/components/ui";
import { ApproveDialog } from "@/components/features/admin/ApproveDialog";
import { Identity, Meter, PageHeader, timeAgo } from "@/components/features/admin/AdminUi";
import styles from "./page.module.scss";

export default function ApprovalsPage() {
  const queue = useAsync(() => adminApi.listUsers(0, 100, undefined, "pending"), []);
  const [approving, setApproving] = useState<AdminUser | null>(null);

  const accounts = queue.data?.users ?? [];

  return (
    <>
      <PageHeader
        title="Approvals"
        description="New accounts start on a hard trial: 3 AI replies and 10 automated replies, for life. Approve an account to put it on a real plan."
      />

      {queue.isLoading ? (
        <Skeleton height={220} />
      ) : accounts.length === 0 ? (
        <Card>
          <EmptyState title="You're all caught up" description="No accounts are waiting for approval." />
        </Card>
      ) : (
        <ul className={styles.queue}>
          {accounts.map((account) => (
            <li key={account.id} className={styles.card}>
              <div className={styles.top}>
                <Identity name={account.name} email={account.email} />
                <div className={styles.facts}>
                  <span>Signed up {timeAgo(account.created_at)}</span>
                  {account.email_verified ? (
                    <Badge variant="success">Email verified</Badge>
                  ) : (
                    <Badge variant="warning">Email not verified</Badge>
                  )}
                  <span>{account.business_count === 1 ? "1 business" : `${account.business_count} businesses`}</span>
                </div>
              </div>

              <TrialUsage userId={account.id} />

              <div className={styles.actions}>
                <Button onClick={() => setApproving(account)}>Approve…</Button>
                <Link href={`/admin/users/${account.id}`}>
                  <Button variant="secondary">Open account</Button>
                </Link>
              </div>
            </li>
          ))}
        </ul>
      )}

      <ApproveDialog
        account={approving}
        isOpen={approving !== null}
        onClose={() => setApproving(null)}
        onDone={() => {
          setApproving(null);
          queue.refresh();
        }}
      />
    </>
  );
}

/** How much of the trial this account has already used. */
function TrialUsage({ userId }: { userId: string }) {
  const detail = useAsync(() => adminApi.getUser(userId), [userId]);
  if (!detail.data) return <div className={styles.usageSkeleton} aria-hidden />;
  return (
    <div className={styles.usage}>
      <Meter label="AI replies" meter={detail.data.usage.ai_replies} />
      <Meter label="Automated replies" meter={detail.data.usage.automated_replies} />
    </div>
  );
}
