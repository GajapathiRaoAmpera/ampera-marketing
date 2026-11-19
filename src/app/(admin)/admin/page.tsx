"use client";

import { useState } from "react";
import Link from "next/link";
import { adminApi, type AdminOverview, type TierId } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { Button, EmptyState, Skeleton } from "@/components/ui";
import { ApproveDialog } from "@/components/features/admin/ApproveDialog";
import {
  Identity,
  PageHeader,
  Panel,
  StatCard,
  StatGrid,
  TIER_NAME,
  adminStyles,
  timeAgo,
} from "@/components/features/admin/AdminUi";
import styles from "./page.module.scss";

const TIER_ORDER: Array<Exclude<TierId, "expired">> = ["trial", "free", "pro", "enterprise"];
const TIER_HELP: Record<Exclude<TierId, "expired">, string> = {
  trial: "waiting for approval",
  free: "approved, free plan",
  pro: "paying, Pro",
  enterprise: "Enterprise",
};

type Waiting = AdminOverview["waiting_for_approval"][number];

export default function AdminOverviewPage() {
  const overview = useAsync(() => adminApi.getOverview(), []);
  const comments = useAsync(() => adminApi.getInstagramCommentMetrics(7, 5).catch(() => null), []);
  const activity = useAsync(() => adminApi.getActivity(8).catch(() => null), []);
  const tokens = useAsync(() => adminApi.getTokenUsageLeaderboard(5).catch(() => null), []);
  const [approving, setApproving] = useState<Waiting | null>(null);

  const data = overview.data;

  if (overview.isLoading || !data) {
    return (
      <>
        <PageHeader title="Overview" description="How the platform is doing, and what needs you." />
        <Skeleton height={360} />
      </>
    );
  }

  const { totals, plans } = data;
  const planTotal = Math.max(1, TIER_ORDER.reduce((sum, tier) => sum + plans[tier], 0));

  return (
    <>
      <PageHeader title="Overview" description="How the platform is doing, and what needs you." />

      {totals.pending_approvals > 0 && (
        <>
          <div className={adminStyles.callout}>
            <div className={adminStyles.calloutText}>
              <div className={adminStyles.calloutTitle}>
                {totals.pending_approvals === 1
                  ? "1 account is waiting for your approval"
                  : `${totals.pending_approvals} accounts are waiting for your approval`}
              </div>
              <div className={adminStyles.calloutBody}>
                Until you approve them they are limited to 3 AI replies and 10 automated replies, for life.
              </div>
            </div>
            <Link href="/admin/approvals">
              <Button>Review approvals</Button>
            </Link>
          </div>

          <Panel title="Next in line" flush>
            <ul className={styles.list}>
              {data.waiting_for_approval.slice(0, 4).map((account) => (
                <li key={account.id} className={styles.listRow}>
                  <Link href={`/admin/users/${account.id}`} className={styles.rowLink}>
                    <Identity name={account.name} email={account.email} />
                  </Link>
                  <span className={styles.rowMeta}>
                    Signed up {timeAgo(account.created_at)} · used {account.ai_replies_used} of 3 AI,{" "}
                    {account.automated_replies_used} of 10 automated
                  </span>
                  <Button size="sm" onClick={() => setApproving(account)}>
                    Approve
                  </Button>
                </li>
              ))}
            </ul>
          </Panel>
        </>
      )}

      <StatGrid>
        <StatCard label="Accounts" value={totals.users.toLocaleString()} hint={`${totals.pending_approvals} awaiting approval`} href="/admin/users" />
        <StatCard label="Businesses" value={totals.businesses.toLocaleString()} />
        <StatCard
          label="AI agents running"
          value={totals.active_agents.toLocaleString()}
          hint={`${totals.paused_agents} paused`}
        />
        <StatCard label="Messages today" value={data.messages.today.toLocaleString()} hint={`${data.messages.week.toLocaleString()} this week`} />
      </StatGrid>

      <div className={adminStyles.twoCol}>
        <Panel title="Who is on which plan" description="Every account, by the plan its limits come from.">
          <ul className={styles.plans}>
            {TIER_ORDER.map((tier) => (
              <li key={tier} className={styles.planRow}>
                <div className={styles.planTop}>
                  <span className={styles.planName}>{TIER_NAME[tier]}</span>
                  <span className={styles.planCount}>
                    {plans[tier].toLocaleString()} <span className={styles.planHelp}>{TIER_HELP[tier]}</span>
                  </span>
                </div>
                <div className={styles.planTrack}>
                  <div
                    className={`${styles.planFill} ${styles[`plan_${tier}`]}`}
                    style={{ width: `${Math.round((plans[tier] / planTotal) * 100)}%` }}
                  />
                </div>
              </li>
            ))}
          </ul>
          <Link href="/admin/settings" className={styles.inlineLink}>
            Edit what each plan includes →
          </Link>
        </Panel>

        <Panel title="Used this month" description="Across every account.">
          <div className={styles.bigNumbers}>
            <div>
              <div className={styles.bigValue}>{data.usage_this_month.ai_replies.toLocaleString()}</div>
              <div className={styles.bigLabel}>AI replies</div>
              <div className={styles.bigHint}>cost LLM tokens</div>
            </div>
            <div>
              <div className={styles.bigValue}>{data.usage_this_month.automated_replies.toLocaleString()}</div>
              <div className={styles.bigLabel}>Automated replies</div>
              <div className={styles.bigHint}>no AI cost</div>
            </div>
          </div>
        </Panel>
      </div>

      <Panel title="Instagram comments, last 7 days" description="Whether comments are getting answered.">
        {!comments.data || comments.data.totals.comments_received === 0 ? (
          <EmptyState title="No Instagram comments yet" description="They are counted from the moment a comment arrives." />
        ) : (
          <>
            <div className={styles.commentTotals}>
              <div>
                <strong>{comments.data.totals.comments_received.toLocaleString()}</strong> received
              </div>
              <div>
                <strong>{comments.data.totals.replied.toLocaleString()}</strong> replied
              </div>
              <div>
                <strong>{comments.data.totals.pending.toLocaleString()}</strong> waiting
              </div>
              <div className={comments.data.totals.missed > 0 ? styles.bad : undefined}>
                <strong>{comments.data.totals.missed.toLocaleString()}</strong> missed
              </div>
            </div>
            {comments.data.accounts.some((a) => a.missed > 0) && (
              <ul className={styles.list}>
                {comments.data.accounts
                  .filter((a) => a.missed > 0)
                  .map((a) => (
                    <li key={a.connection_id} className={styles.listRow}>
                      <span className={styles.rowLink}>
                        {a.business_id ? (
                          <Link href={`/admin/businesses/${a.business_id}`}>@{a.instagram_username ?? a.connection_id}</Link>
                        ) : (
                          <>@{a.instagram_username ?? a.connection_id}</>
                        )}
                      </span>
                      <span className={styles.rowMeta}>
                        {a.missed.toLocaleString()} missed of {a.comments_received.toLocaleString()}
                      </span>
                    </li>
                  ))}
              </ul>
            )}
          </>
        )}
      </Panel>

      <div className={adminStyles.twoCol}>
        <Panel title="Biggest AI users" description="By LLM tokens, all time.">
          {!tokens.data || tokens.data.usage.length === 0 ? (
            <EmptyState title="No usage yet" />
          ) : (
            <ul className={styles.compactList}>
              {tokens.data.usage.map((row) => (
                <li key={row.user_id} className={styles.compactRow}>
                  <Link href={`/admin/users/${row.user_id}`} className={styles.rowLink}>
                    {row.name ?? row.email ?? row.user_id}
                  </Link>
                  <span className={styles.rowMeta}>{row.total_tokens.toLocaleString()} tokens</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>

        <Panel title="Recent activity">
          {!activity.data || activity.data.activity.length === 0 ? (
            <EmptyState title="Nothing yet" />
          ) : (
            <ul className={styles.compactList}>
              {activity.data.activity.map((item) => (
                <li key={`${item.type}-${item.id}`} className={styles.activityRow}>
                  <span>{item.summary ?? item.action ?? "-"}</span>
                  <span className={styles.rowMeta}>{timeAgo(item.created_at)}</span>
                </li>
              ))}
            </ul>
          )}
        </Panel>
      </div>

      <ApproveDialog
        account={approving}
        isOpen={approving !== null}
        onClose={() => setApproving(null)}
        onDone={() => {
          setApproving(null);
          overview.refresh();
        }}
      />
    </>
  );
}
