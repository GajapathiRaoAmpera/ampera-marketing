"use client";

import { useEffect, useMemo, useState } from "react";
import {
  instagramAutomationsApi,
  type InstagramAccountCommentMetrics,
  type InstagramAutomation,
  type InstagramAutomationAnalytics,
  type InstagramExecution,
} from "@/lib/api";
import { Button, InfoTip, Skeleton } from "@/components/ui";
import { ActivityList } from "./ActivityTab";
import { IconTile } from "./icons";
import styles from "./workspace.module.scss";
import { parseServerDate } from "@/lib/utils/date";

const PERIODS = [7, 30, 90];

function rate(part: number, whole: number): string {
  return whole > 0 ? `${Math.round((part / whole) * 100)}%` : "–";
}

function pct(part: number, whole: number): number {
  return whole > 0 ? Math.max(2, Math.min(100, (part / whole) * 100)) : 0;
}

interface OverviewTabProps {
  businessId: string;
  connectionId: string;
  automations: InstagramAutomation[];
  executions: InstagramExecution[];
  canBuild: boolean;
  onNew: () => void;
  onGo: (tab: "automations" | "activity") => void;
}

export function OverviewTab({ businessId, connectionId, automations, executions, canBuild, onNew, onGo }: OverviewTabProps) {
  const [days, setDays] = useState(7);
  const [metrics, setMetrics] = useState<Record<string, InstagramAccountCommentMetrics>>({});
  const [failed, setFailed] = useState<Record<string, boolean>>({});
  const [analytics, setAnalytics] = useState<Record<string, InstagramAutomationAnalytics>>({});
  // "The last N days" counts back from when the page was opened.
  const [openedAt] = useState(() => Date.now());
  const key = `${connectionId}|${days}`;
  const data = metrics[key];

  useEffect(() => {
    let cancelled = false;
    instagramAutomationsApi
      .commentMetrics(businessId, connectionId, days)
      .then((result) => !cancelled && setMetrics((all) => ({ ...all, [key]: result })))
      .catch(() => !cancelled && setFailed((all) => ({ ...all, [key]: true })));
    return () => {
      cancelled = true;
    };
  }, [businessId, connectionId, days, key]);

  const automationIds = automations.map((item) => item.id).join(",");
  useEffect(() => {
    if (!automationIds) return;
    let cancelled = false;
    Promise.all(
      automationIds.split(",").slice(0, 20).map((id) => instagramAutomationsApi.analytics(businessId, id).catch(() => null))
    ).then((rows) => {
      if (cancelled) return;
      setAnalytics(Object.fromEntries(rows.filter((row): row is InstagramAutomationAnalytics => Boolean(row)).map((row) => [row.automation_id, row])));
    });
    return () => {
      cancelled = true;
    };
  }, [businessId, automationIds]);

  const live = automations.filter((item) => item.status === "active").length;
  const since = openedAt - days * 86400_000;
  const otherEvents = useMemo(
    () =>
      executions.filter(
        (item) =>
          !["comment", "live_comment", "continuation"].includes(item.event_type) &&
          item.created_at &&
          parseServerDate(item.created_at).getTime() >= since
      ),
    [executions, since]
  );
  const dmAnswered = otherEvents.filter((item) => item.status === "succeeded" || item.status === "partial").length;

  const top = automations
    .map((item) => ({ item, stats: analytics[item.id] }))
    .filter((row) => row.stats && row.stats.total_executions > 0)
    .sort((a, b) => (b.stats?.total_executions ?? 0) - (a.stats?.total_executions ?? 0))
    .slice(0, 5);

  if (automations.length === 0) {
    return (
      <div className={styles.panel}>
        <div className={styles.empty}>
          <IconTile name="bolt" tone="pink" size="lg" />
          <h3>Create your first automation</h3>
          <p>
            Pick a post, choose a keyword like “price”, and write a reply. Everyone who comments that word gets an instant public reply and a DM.
          </p>
          {canBuild && (
            <Button size="lg" onClick={onNew}>
              + New automation
            </Button>
          )}
        </div>
      </div>
    );
  }

  const received = data?.comments_received ?? 0;
  const triggered = data?.triggered ?? (data ? data.replied + data.pending + data.missed + data.blocked_by_plan : 0);
  const missedTotal = data ? data.missed : 0;

  return (
    <div className={styles.panel}>
      <div className={styles.sectionTitle}>
        <h3>How your Instagram is doing</h3>
        <div className={styles.periods} role="group" aria-label="Period">
          {PERIODS.map((value) => (
            <button key={value} type="button" aria-pressed={days === value} onClick={() => setDays(value)}>
              {value} days
            </button>
          ))}
        </div>
      </div>

      {!data && !failed[key] ? (
        <Skeleton height={220} />
      ) : !data ? (
        <p className={styles.muted}>Comment numbers couldn&apos;t be loaded right now.</p>
      ) : (
        <>
          <div className={styles.stats}>
            <Stat label="Comments received" value={received} />
            <Stat label="Triggered an automation" info="Comments that matched one of your automations (right post and keyword), whether or not the reply could be sent." value={triggered} hint={rate(triggered, received) + " of comments"} />
            <Stat label="Answered" info="Comments that got at least one reply, public or by DM." value={data.replied} hint={`${rate(data.replied, triggered)} of triggered`} tone="good" />
            <Stat label="Failed / missed" info="Matched, but no reply could be sent: Instagram refused it, the comment was over 7 days old, or the account was disconnected." value={missedTotal} tone={missedTotal ? "bad" : undefined} hint={missedTotal ? "See reasons below" : "Nothing missed"} />
            <Stat label="Waiting to send" info="Replies queued and going out shortly. They are spaced out on purpose so Instagram doesn’t see a burst." value={data.pending} tone={data.pending ? "warn" : undefined} hint={data.waiting_for_limits ? `${data.waiting_for_limits} paced by limits` : "Up to date"} />
            <Stat label="No keyword match" info="Comments none of your automations covered, because of the keyword, the post, or who sent it." value={data.not_matched} hint="Comments no rule answered" />
            <Stat label="Removed comments" info="Comments deleted or hidden automatically by your rules in Settings, e.g. ones sharing a phone number." value={data.removed ?? 0} hint="Phone numbers, links, etc." />
            <Stat label="DMs answered" value={dmAnswered} hint={`of ${otherEvents.length} DMs & story replies`} />
            <Stat label="Automations live" value={live} hint={`${automations.length} total`} />
            {data.blocked_by_plan > 0 && <Stat label="Stopped by plan limit" value={data.blocked_by_plan} tone="warn" hint="Upgrade to answer these" />}
          </div>

          {received > 0 && (
            <div className={styles.card}>
              <div className={styles.cardHead}>
                <div>
                  <h3>Comment funnel</h3>
                  <p>What happened to the {received} comments you received in the last {days} days.</p>
                </div>
              </div>
              <div className={styles.funnel}>
                <FunnelRow label="Received" value={received} of={received} />
                <FunnelRow label="Triggered" value={triggered} of={received} />
                <FunnelRow label="Answered" value={data.replied} of={received} tone="good" />
                <FunnelRow label="Failed / missed" value={missedTotal} of={received} tone="bad" />
                <FunnelRow label="Skipped" value={data.skipped} of={received} tone="muted" />
                <FunnelRow label="No match" value={data.not_matched} of={received} tone="muted" />
              </div>
              {missedTotal > 0 && (
                <details className={styles.details}>
                  <summary>Why {missedTotal} {missedTotal === 1 ? "comment was" : "comments were"} missed</summary>
                  <p>
                    {data.missed_breakdown.failed > 0 && `${data.missed_breakdown.failed} failed to send (Instagram refused the message). `}
                    {data.missed_breakdown.expired > 0 && `${data.missed_breakdown.expired} were older than 7 days, after which Instagram no longer allows a private reply. `}
                    {data.missed_breakdown.stuck_unprocessed > 0 && `${data.missed_breakdown.stuck_unprocessed} were not processed in time. `}
                    {data.missed_breakdown.no_connection > 0 && `${data.missed_breakdown.no_connection} arrived while the account was disconnected.`}
                  </p>
                </details>
              )}
            </div>
          )}
        </>
      )}

      {top.length > 0 && (
        <div className={styles.card}>
          <div className={styles.cardHead}>
            <div>
              <h3>Top automations</h3>
              <p>All-time runs for your busiest automations.</p>
            </div>
            <Button size="sm" variant="ghost" onClick={() => onGo("automations")}>
              Manage →
            </Button>
          </div>
          <ul className={styles.miniList}>
            {top.map(({ item, stats }) => (
              <li key={item.id}>
                <span>{item.name}</span>
                <span className={styles.muted}>
                  {stats!.total_executions} runs · {rate(stats!.succeeded, stats!.total_executions)} sent
                  {stats!.failed ? ` · ${stats!.failed} failed` : ""}
                </span>
              </li>
            ))}
          </ul>
        </div>
      )}

      <div className={styles.card}>
        <div className={styles.cardHead}>
          <div>
            <h3>Latest activity</h3>
            <p>The most recent comments and messages your automations handled.</p>
          </div>
          <Button size="sm" variant="ghost" onClick={() => onGo("activity")}>
            See all →
          </Button>
        </div>
        <ActivityList executions={executions.slice(0, 5)} automations={automations} />
      </div>
    </div>
  );
}

function Stat({ label, value, hint, tone, info }: { label: string; value: number; hint?: string; tone?: "good" | "bad" | "warn"; info?: string }) {
  const toneClass = tone === "good" ? styles.statGood : tone === "bad" ? styles.statBad : tone === "warn" ? styles.statWarn : "";
  return (
    <div className={`${styles.stat} ${toneClass}`}>
      <span className={styles.statLabelRow}>
        <span className={styles.statLabel} title={label}>
          {label}
        </span>
        {info && <InfoTip help={info} />}
      </span>
      <span className={styles.statValue}>{value.toLocaleString()}</span>
      {hint && <span className={styles.statHint} title={hint}>{hint}</span>}
    </div>
  );
}

function FunnelRow({ label, value, of, tone }: { label: string; value: number; of: number; tone?: "good" | "bad" | "muted" }) {
  const toneClass = tone === "good" ? styles.barGood : tone === "bad" ? styles.barBad : tone === "muted" ? styles.barMuted : "";
  return (
    <div className={styles.funnelRow}>
      <span>{label}</span>
      <div className={`${styles.bar} ${toneClass}`}>
        <span style={{ width: value ? `${pct(value, of)}%` : 0 }} />
      </div>
      <span>{value.toLocaleString()}</span>
    </div>
  );
}
