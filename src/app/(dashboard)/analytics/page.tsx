"use client";

import { dashboardApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { Card, EmptyState, Skeleton } from "@/components/ui";
import { StatTile } from "@/components/features/dashboard-home/StatTile";
import { ChartIcon } from "@/components/layout/icons";
import { ChannelGate } from "@/components/features/channels/workspace/ChannelGate";
import { ChannelWorkspace } from "@/components/features/channels/workspace/ChannelWorkspace";
import styles from "./page.module.scss";

function formatPercent(value: number | null): string | null {
  if (value === null) return null;
  return `${Math.round(value * 100)}%`;
}

function formatSeconds(value: number | null): string | null {
  if (value === null) return null;
  return `${value}s`;
}

function Analytics({ businessId }: { businessId: string }) {
  const { data: overview, isLoading: overviewLoading } = useAsync(() => dashboardApi.analyticsOverview(businessId), [businessId]);
  const { data: sales, isLoading: salesLoading } = useAsync(() => dashboardApi.analyticsSales(businessId), [businessId]);
  const { data: ai, isLoading: aiLoading } = useAsync(() => dashboardApi.analyticsAi(businessId), [businessId]);

  return (
    <ChannelWorkspace
      color="#2d7ff9"
      icon={<ChartIcon size={34} />}
      name="Analytics"
      identity="Analytics"
      subtitle="Snapshot numbers across every channel, not trends over time yet"
      connected
      landing={{ headline: "", text: "", steps: [], panel: null }}
      tabs={[
        {
          value: "overview",
          label: "Overview",
          icon: "overview",
          intro: "How fast you reply, how often a person had to step in, and what customers ask about most.",
          render: () =>
            overviewLoading || !overview ? (
              <Skeleton height={200} />
            ) : (
              <>
                <div className={styles.grid}>
                  <StatTile label="Avg. response time" value={formatSeconds(overview.average_response_time)} note={overview.average_response_time_note} icon={<ChartIcon size={18} />} />
                  <StatTile label="Human takeover rate" value={formatPercent(overview.human_takeover_rate)} note={overview.human_takeover_rate_note} icon={<ChartIcon size={18} />} />
                </div>
                <Card>
                  <div style={{ fontWeight: 600, fontSize: "var(--font-size-md)" }}>Top intents</div>
                  {overview.top_intents_note && <p style={{ fontSize: "var(--font-size-xs)", color: "var(--color-text-tertiary)", marginTop: 4 }}>{overview.top_intents_note}</p>}
                  {overview.top_intents.length === 0 ? (
                    <div style={{ marginTop: "var(--space-4)" }}>
                      <EmptyState title="Not enough data yet" description="Intents will populate here as customers chat." />
                    </div>
                  ) : (
                    <div className={styles.intentsList}>
                      {overview.top_intents.map((intent) => (
                        <div key={intent.intent} className={styles.intentRow}>
                          <span>{intent.intent}</span>
                          <span className={styles.intentCount}>{intent.count}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              </>
            ),
        },
        {
          value: "sales",
          label: "Sales",
          icon: "gauge",
          intro: "Revenue from orders the assistant helped win.",
          render: () =>
            salesLoading || !sales ? (
              <Skeleton height={140} />
            ) : (
              <div className={styles.grid}>
                <StatTile label="Revenue generated" value={sales.revenue_generated} note={sales.revenue_generated_note} icon={<ChartIcon size={18} />} />
              </div>
            ),
        },
        {
          value: "ai",
          label: "AI performance",
          icon: "bot",
          intro: "How much of the work the assistant does on its own, and how quickly.",
          render: () =>
            aiLoading || !ai ? (
              <Skeleton height={200} />
            ) : (
              <div className={styles.grid}>
                <StatTile label="Avg. response time" value={formatSeconds(ai.average_response_time)} note={ai.average_response_time_note} icon={<ChartIcon size={18} />} />
                <StatTile label="AI resolution rate" value={formatPercent(ai.ai_resolution_rate)} note={ai.ai_resolution_rate_note} icon={<ChartIcon size={18} />} />
                <StatTile
                  label="Knowledge usage"
                  value={ai.knowledge_usage.tracked ? "Tracked" : null}
                  note={ai.knowledge_usage.tracked ? undefined : "Not tracked yet by the backend."}
                  icon={<ChartIcon size={18} />}
                />
              </div>
            ),
        },
      ]}
    />
  );
}

export default function AnalyticsPage() {
  return <ChannelGate channel="analytics">{(businessId) => <Analytics businessId={businessId} />}</ChannelGate>;
}
