"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import clsx from "clsx";
import { Badge, Button, Card, EmptyState, Select, Skeleton } from "@/components/ui";
import {
  dispositionLabel, formatDuration, voiceCenterApi,
  type LiveCall, type VoiceAnalytics, type VoiceInsight, type VoiceStatus,
} from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { LiveCallRow } from "./LiveCallRow";
import { QuickCall } from "./QuickCall";
import styles from "./VoiceCenter.module.scss";

export type VoiceTab = "overview" | "calls" | "messages" | "campaigns" | "rules" | "dnc";

interface OverviewTabProps {
  status: VoiceStatus | null;
  onNavigate: (tab: VoiceTab) => void;
}

const percent = (value: number | null) => (value === null ? "–" : `${Math.round(value * 100)}%`);

function change(current: number, previous: number): string {
  if (!previous) return current ? "New this period" : "No calls yet";
  const delta = Math.round(((current - previous) / previous) * 100);
  return `${delta >= 0 ? "+" : ""}${delta}% vs previous period`;
}

export function OverviewTab({ status, onNavigate }: OverviewTabProps) {
  const { show } = useToast();
  const router = useRouter();
  const [days, setDays] = useState(30);
  const [data, setData] = useState<VoiceAnalytics | null>(null);
  const [failed, setFailed] = useState(false);
  const [attempt, setAttempt] = useState(0);
  const [live, setLive] = useState<LiveCall[]>([]);
  const [isCalling, setIsCalling] = useState(false);

  const isReady = Boolean(status?.connected && status.agent_id);

  const loadLive = useCallback(() => {
    voiceCenterApi.live().then((res) => setLive(res.calls)).catch(() => {});
  }, []);

  useEffect(() => {
    let canceled = false;
    voiceCenterApi.analytics(days)
      .then((value) => { if (!canceled) { setData(value); setFailed(false); } })
      .catch(() => { if (!canceled) setFailed(true); });
    return () => { canceled = true; };
  }, [days, attempt]);

  useEffect(() => {
    loadLive();
    const timer = setInterval(loadLive, 5000);
    return () => clearInterval(timer);
  }, [loadLive]);

  async function endCall(call: LiveCall) {
    try {
      await voiceCenterApi.hangup(call.id);
      show("Call ended.", "default");
      loadLive();
    } catch {
      show("Couldn't end that call. It may have just finished.", "error");
    }
  }

  function openInsight(insight: VoiceInsight) {
    if (insight.action === "knowledge") router.push("/knowledge-base");
    else if (insight.action === "flow") router.push("/channels/voice/studio");
    else onNavigate(insight.action);
  }

  if (failed) {
    return (
      <EmptyState
        title="Couldn't load your call results"
        description="Your calls are not affected. Check your connection and try again."
        action={<Button onClick={() => { setFailed(false); setAttempt((value) => value + 1); }}>Try again</Button>}
      />
    );
  }
  if (!data) return <Skeleton height={420} />;

  const { totals } = data;
  const maxDay = Math.max(1, ...data.by_day.map((d) => d.inbound + d.outbound));
  const activeHours = data.by_hour.filter((h) => h.hour >= 7 && h.hour <= 22);
  const maxHour = Math.max(1, ...activeHours.map((h) => h.calls));
  const bestHour = activeHours.filter((h) => h.outbound >= 5)
    .sort((a, b) => b.outbound_connected / b.outbound - a.outbound_connected / a.outbound)[0];
  const maxDisposition = Math.max(1, ...data.dispositions.map((d) => d.count));
  const queuedTotal = data.queued.scheduled + data.queued.retries + data.queued.callbacks;

  return (
    <div className={clsx(styles.stack, styles.chartScope)}>
      <div className={styles.toolbar}>
        <div style={{ width: 180 }}>
          <Select value={days} onChange={(e) => setDays(Number(e.target.value))} aria-label="Time range">
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </Select>
        </div>
        <div className={styles.spacer} />
        <Button variant="secondary" onClick={() => onNavigate("campaigns")} disabled={!isReady}>New campaign</Button>
        <Button onClick={() => setIsCalling(true)} disabled={!isReady}>Call someone</Button>
      </div>

      {live.length > 0 && (
        <Card>
          <div className={styles.sectionTitle}>Live now</div>
          <div className={styles.list}>
            {live.map((call) => <LiveCallRow key={call.id} call={call} onEnd={endCall} onChanged={loadLive} />)}
          </div>
        </Card>
      )}

      <div className={styles.kpiGrid}>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Calls handled</div>
          <div className={styles.kpiValue}>{totals.calls}</div>
          <div className={styles.kpiNote}>{change(totals.calls, data.previous.calls)}</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Real conversations</div>
          <div className={styles.kpiValue}>{totals.connected}</div>
          <div className={styles.kpiNote}>{percent(totals.connect_rate)} of calls reached a person</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Bookings</div>
          <div className={styles.kpiValue}>{totals.bookings}</div>
          <div className={styles.kpiNote}>{totals.positive_outcomes} positive outcomes in total</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Handled without your team</div>
          <div className={styles.kpiValue}>{percent(totals.resolved_rate)}</div>
          <div className={styles.kpiNote}>{totals.transferred} transferred to a person</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Average call</div>
          <div className={styles.kpiValue}>{formatDuration(totals.avg_duration_seconds) || "–"}</div>
          <div className={styles.kpiNote}>{totals.total_minutes} minutes in total</div>
        </div>
        <div className={styles.kpi}>
          <div className={styles.kpiLabel}>Call quality</div>
          <div className={styles.kpiValue}>{totals.avg_qa_score ?? "–"}{totals.avg_qa_score !== null && <span className={styles.muted}> /100</span>}</div>
          <div className={styles.kpiNote}>Scored on every conversation</div>
        </div>
      </div>

      {data.insights.length > 0 && (
        <div>
          <div className={styles.sectionTitle} style={{ marginBottom: "var(--space-3)" }}>What to do next</div>
          <div className={styles.insightList}>
            {data.insights.map((insight) => (
              <button
                key={insight.title}
                className={clsx(styles.insight, insight.tone === "good" && styles.insightGood, insight.tone === "warn" && styles.insightWarn)}
                onClick={() => openInsight(insight)}
              >
                <div className={styles.insightTitle}>{insight.title}</div>
                <div className={styles.insightDetail}>{insight.detail}</div>
              </button>
            ))}
          </div>
        </div>
      )}

      {totals.calls === 0 ? (
        <Card>
          <EmptyState
            title="No calls in this period"
            description="Incoming calls show up here on their own. To see results faster, call a contact or start a campaign."
          />
        </Card>
      ) : (
        <>
          <div className={styles.twoCol}>
            <Card>
              <div className={styles.ruleHeader}>
                <div className={styles.sectionTitle}>Calls per day</div>
                <div className={styles.legend}>
                  <span><span className={styles.legendSwatch} style={{ background: "var(--series-inbound)" }} />Incoming</span>
                  <span><span className={styles.legendSwatch} style={{ background: "var(--series-outbound)" }} />Outgoing</span>
                </div>
              </div>
              <div className={styles.bars} role="img" aria-label={`Calls per day over the last ${data.days} days`}>
                {data.by_day.map((day) => (
                  <div key={day.date} className={styles.barSlot} tabIndex={0}>
                    {day.outbound > 0 && (
                      <div className={clsx(styles.barSegment, styles.barOutbound, styles.barTop)} style={{ height: `${(day.outbound / maxDay) * 100}%` }} />
                    )}
                    {day.inbound > 0 && (
                      <div className={clsx(styles.barSegment, styles.barInbound, day.outbound === 0 && styles.barTop)} style={{ height: `${(day.inbound / maxDay) * 100}%` }} />
                    )}
                    <div className={styles.tooltip}>
                      <strong>{new Date(`${day.date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</strong><br />
                      Incoming {day.inbound} · Outgoing {day.outbound}<br />
                      {day.connected} conversations
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.axis}>
                <span>{new Date(`${data.by_day[0].date}T00:00:00`).toLocaleDateString(undefined, { day: "numeric", month: "short" })}</span>
                <span>Busiest day: {maxDay} calls</span>
                <span>Today</span>
              </div>
            </Card>

            <Card>
              <div className={styles.sectionTitle}>How calls ended</div>
              {data.dispositions.length === 0 ? (
                <p className={styles.sectionHint}>Outcomes appear a few seconds after each call finishes.</p>
              ) : (
                <div className={styles.breakdown}>
                  {data.dispositions.slice(0, 8).map((item) => (
                    <div key={item.key} className={styles.breakdownRow}>
                      <span>{dispositionLabel(item.key)}</span>
                      <div className={styles.breakdownTrack}>
                        <div className={styles.breakdownFill} style={{ width: `${(item.count / maxDisposition) * 100}%` }} />
                      </div>
                      <span className={styles.breakdownCount}>{item.count}</span>
                    </div>
                  ))}
                </div>
              )}
            </Card>
          </div>

          <div className={styles.twoCol}>
            <Card>
              <div className={styles.sectionTitle}>Calls by hour of day</div>
              <p className={styles.sectionHint}>
                {bestHour
                  ? `Outgoing calls placed around ${bestHour.hour}:00 reach a person most often (${Math.round((bestHour.outbound_connected / bestHour.outbound) * 100)}%).`
                  : `Times shown in ${data.timezone}. The best hour to call is highlighted once there are enough outgoing calls.`}
              </p>
              <div className={styles.bars} style={{ height: 110 }} role="img" aria-label="Calls by hour of day">
                {activeHours.map((hour) => (
                  <div key={hour.hour} className={styles.barSlot} tabIndex={0}>
                    {hour.calls > 0 && (
                      <div
                        className={clsx(styles.barSegment, styles.barSingle, styles.barTop, bestHour?.hour === hour.hour && styles.barBest)}
                        style={{ height: `${(hour.calls / maxHour) * 100}%` }}
                      />
                    )}
                    <div className={styles.tooltip}>
                      <strong>{hour.hour}:00</strong><br />
                      {hour.calls} calls · {hour.connected} conversations
                    </div>
                  </div>
                ))}
              </div>
              <div className={styles.axis}><span>7am</span><span>12pm</span><span>5pm</span><span>10pm</span></div>
            </Card>

            <Card>
              <div className={styles.sectionTitle}>Questions your agent couldn&apos;t answer</div>
              {data.unanswered_questions.length === 0 ? (
                <p className={styles.sectionHint}>None so far. When a caller asks something the agent doesn&apos;t know, it is listed here so you can add the answer.</p>
              ) : (
                <>
                  <div className={styles.list}>
                    {data.unanswered_questions.slice(0, 5).map((item) => (
                      <div key={item.question} className={styles.listRow}>
                        <div className={styles.listMain}>{item.question}?</div>
                        {item.count > 1 && <Badge variant="warning">asked {item.count}×</Badge>}
                      </div>
                    ))}
                  </div>
                  <Link href="/knowledge-base">Add answers to your knowledge base →</Link>
                </>
              )}
            </Card>
          </div>

          <Card>
            <div className={styles.sectionTitle}>Also in this period</div>
            <div className={styles.statRow}>
              <span><span className={styles.statValue}>{totals.after_hours}</span> answered after hours</span>
              <span><span className={styles.statValue}>{totals.returning_callers}</span> from returning callers</span>
              <span><span className={styles.statValue}>{totals.voicemails}</span> reached voicemail</span>
              <span><span className={styles.statValue}>{totals.missed_inbound}</span> hung up before speaking</span>
              <span><span className={styles.statValue}>{totals.callbacks_scheduled}</span> callbacks booked automatically</span>
              <span><span className={styles.statValue}>{queuedTotal}</span> calls queued ({data.queued.retries} retries, {data.queued.callbacks} callbacks)</span>
            </div>
          </Card>
        </>
      )}

      {isCalling && <QuickCall isOpen onClose={() => setIsCalling(false)} onPlaced={loadLive} />}
    </div>
  );
}
