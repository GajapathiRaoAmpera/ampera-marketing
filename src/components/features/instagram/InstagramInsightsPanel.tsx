"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Image from "next/image";
import {
  instagramAutomationsApi,
  ApiError,
  type InstagramConnection,
  type InstagramInsightMetric,
  type InstagramInsightPeriod,
  type InstagramMedia,
} from "@/lib/api";
import { Badge, Card, EmptyState, Select, Skeleton, Tabs } from "@/components/ui";
import styles from "./InstagramInsightsPanel.module.scss";

const PERIOD_OPTIONS: Array<{ value: InstagramInsightPeriod; label: string }> = [
  { value: "day", label: "Today" },
  { value: "week", label: "Last 7 days" },
  { value: "days_28", label: "Last 28 days" },
];

const METRIC_LABELS: Record<string, string> = {
  accounts_engaged: "Accounts engaged",
  total_interactions: "Total interactions",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  saves: "Saves",
  replies: "Replies",
  follows_and_unfollows: "Follows & unfollows",
  profile_links_taps: "Profile link taps",
  views: "Views",
  reach: "Reach",
  website_clicks: "Website clicks",
};

const MEDIA_METRIC_LABELS: Record<string, string> = {
  reach: "Reach",
  likes: "Likes",
  comments: "Comments",
  shares: "Shares",
  saved: "Saved",
  total_interactions: "Total interactions",
  views: "Views",
};

function metricLabel(name: string, dict: Record<string, string>): string {
  return dict[name] ?? name.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function metricValue(metric: InstagramInsightMetric): number {
  if (typeof metric.total_value?.value === "number") return metric.total_value.value;
  const last = metric.values?.[metric.values.length - 1];
  return typeof last?.value === "number" ? last.value : 0;
}

function formatCompact(value: number): string {
  return new Intl.NumberFormat("en", { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

interface InsightsBarChartProps {
  items: Array<{ key: string; label: string; value: number }>;
  emptyLabel: string;
}

/**
 * Horizontal magnitude bars, single sequential hue (per the data-viz method:
 * these are metric *names* compared by size, not identity, so every bar
 * takes the same slot, color would just re-encode what length already
 * shows). Colors come from the dataviz skill's validated reference palette,
 * scoped to this component only via .vizRoot, the rest of the app keeps
 * its existing brand tokens untouched.
 */
function InsightsBarChart({ items, emptyLabel }: InsightsBarChartProps) {
  const [hovered, setHovered] = useState<string | null>(null);
  const max = Math.max(1, ...items.map((item) => item.value));

  if (items.length === 0) {
    return <p className={styles.chartEmpty}>{emptyLabel}</p>;
  }

  return (
    <div className={styles.vizRoot}>
      <div className={styles.barList} role="list">
        {items.map((item) => {
          const pct = Math.max(2, (item.value / max) * 100);
          const isHovered = hovered === item.key;
          return (
            <div
              className={styles.barRow}
              role="listitem"
              key={item.key}
              tabIndex={0}
              onPointerEnter={() => setHovered(item.key)}
              onPointerLeave={() => setHovered((current) => (current === item.key ? null : current))}
              onFocus={() => setHovered(item.key)}
              onBlur={() => setHovered((current) => (current === item.key ? null : current))}
            >
              <span className={styles.barLabel}>{item.label}</span>
              <div className={styles.barTrack}>
                <div
                  className={styles.barFill}
                  style={{ width: `${pct}%` }}
                  data-hovered={isHovered || undefined}
                />
              </div>
              <span className={styles.barValue}>{formatCompact(item.value)}</span>
              {isHovered && (
                <div className={styles.tooltip} role="tooltip">
                  <strong>{formatCompact(item.value)}</strong>
                  <span>{item.label}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ConnectionPicker({
  connections,
  value,
  onChange,
}: {
  connections: InstagramConnection[];
  value: string;
  onChange: (id: string) => void;
}) {
  if (connections.length <= 1) return null;
  return (
    <Select label="Account" value={value} onChange={(e) => onChange(e.target.value)}>
      {connections.map((conn) => (
        <option key={conn.id} value={conn.id}>
          @{conn.instagram_username}
        </option>
      ))}
    </Select>
  );
}

export function InstagramInsightsPanel({ businessId }: { businessId: string }) {
  const [connections, setConnections] = useState<InstagramConnection[]>([]);
  const [connectionId, setConnectionId] = useState<string>("");
  const [period, setPeriod] = useState<InstagramInsightPeriod>("day");
  const [metrics, setMetrics] = useState<InstagramInsightMetric[]>([]);
  const [media, setMedia] = useState<InstagramMedia[]>([]);
  const [mediaInsights, setMediaInsights] = useState<Record<string, InstagramInsightMetric[]>>({});
  const [expandedMediaId, setExpandedMediaId] = useState<string | null>(null);
  const [isLoadingConnections, setIsLoadingConnections] = useState(true);
  const [isLoadingInsights, setIsLoadingInsights] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [permissionMissing, setPermissionMissing] = useState(false);

  useEffect(() => {
    let cancelled = false;
    // Deferred so the first setState doesn't run synchronously in the effect body.
    const timer = window.setTimeout(() => {
      setIsLoadingConnections(true);
      instagramAutomationsApi
        .connections(businessId)
        .then((list) => {
          if (cancelled) return;
          setConnections(list);
          setConnectionId((current) => current || list[0]?.id || "");
        })
        .catch(() => {
          if (!cancelled) setConnections([]);
        })
        .finally(() => {
          if (!cancelled) setIsLoadingConnections(false);
        });
    }, 0);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [businessId]);

  const loadInsights = useCallback(async () => {
    if (!businessId || !connectionId) return;
    setIsLoadingInsights(true);
    setError(null);
    setPermissionMissing(false);
    try {
      const [insightsRes, mediaRes] = await Promise.all([
        instagramAutomationsApi.insights(businessId, connectionId, { period, metricType: "total_value" }),
        instagramAutomationsApi.media(businessId, connectionId, { limit: 100 }),
      ]);
      setMetrics(insightsRes.data || []);
      const items = (mediaRes.data || []).slice(0, 12);
      setMedia(items);

      const perMediaResults = await Promise.all(
        items.map((item) =>
          instagramAutomationsApi
            .mediaInsights(businessId, item.id, connectionId)
            .then((res) => [item.id, res.data || []] as const)
            .catch(() => [item.id, []] as const)
        )
      );
      setMediaInsights(Object.fromEntries(perMediaResults));
    } catch (err) {
      if (err instanceof ApiError && err.status === 403) {
        setPermissionMissing(true);
      } else {
        setError(err instanceof ApiError ? err.userMessage : "Couldn't load insights. Please try again.");
      }
      setMetrics([]);
      setMedia([]);
      setMediaInsights({});
    } finally {
      setIsLoadingInsights(false);
    }
  }, [businessId, connectionId, period]);

  useEffect(() => {
    // Deferred so the first setState doesn't run synchronously in the effect body.
    const timer = window.setTimeout(() => void loadInsights(), 0);
    return () => window.clearTimeout(timer);
  }, [loadInsights]);

  const headline = useMemo(() => {
    const byName = new Map(metrics.map((m) => [m.name, m]));
    const pick = (name: string) => (byName.has(name) ? metricValue(byName.get(name)!) : null);
    return {
      accountsEngaged: pick("accounts_engaged"),
      totalInteractions: pick("total_interactions"),
      reach: pick("reach"),
      follows: pick("follows_and_unfollows"),
    };
  }, [metrics]);

  const barItems = useMemo(
    () =>
      metrics
        .filter((m) => m.name !== "reach" || period !== "day")
        .map((m) => ({ key: m.name, label: metricLabel(m.name, METRIC_LABELS), value: metricValue(m) }))
        .filter((item) => item.value > 0)
        .sort((a, b) => b.value - a.value),
    [metrics, period]
  );

  if (isLoadingConnections) {
    return <Skeleton height={280} />;
  }

  if (connections.length === 0) {
    return (
      <EmptyState
        title="Connect Instagram first"
        description="Insights become available once an Instagram Professional account is connected."
      />
    );
  }

  return (
    <div>
      <div className={styles.controls}>
        <ConnectionPicker connections={connections} value={connectionId} onChange={setConnectionId} />
        <Tabs
          options={PERIOD_OPTIONS}
          value={period}
          onChange={setPeriod}
        />
      </div>

      {permissionMissing ? (
        <Card>
          <EmptyState
            title="Insights permission not granted yet"
            description="This connection was authorized before Instagram insights were enabled. Disconnect and reconnect Instagram to grant the additional permission. Your automations and history are kept."
          />
        </Card>
      ) : isLoadingInsights ? (
        <Skeleton height={360} />
      ) : error ? (
        <Card>
          <p className={styles.errorText}>{error}</p>
        </Card>
      ) : (
        <>
          <div className={styles.statGrid}>
            <StatTile label="Reach" value={headline.reach} />
            <StatTile label="Accounts engaged" value={headline.accountsEngaged} />
            <StatTile label="Total interactions" value={headline.totalInteractions} />
            <StatTile label="Follows & unfollows" value={headline.follows} />
          </div>

          <Card className={styles.chartCard}>
            <h3 className={styles.cardTitle}>Engagement breakdown</h3>
            <p className={styles.cardHint}>
              {PERIOD_OPTIONS.find((opt) => opt.value === period)?.label} · account-wide totals across every post, Reel and Story.
            </p>
            <InsightsBarChart items={barItems} emptyLabel="No activity in this window yet." />
          </Card>

          <Card className={styles.chartCard}>
            <h3 className={styles.cardTitle}>Recent posts</h3>
            <p className={styles.cardHint}>Click a post to see its individual reach, likes, comments, shares and saves.</p>
            {media.length === 0 ? (
              <p className={styles.hint}>No posts yet. Publish something to see per-post insights here.</p>
            ) : (
              <div className={styles.mediaGrid}>
                {media.map((item) => {
                  const isExpanded = expandedMediaId === item.id;
                  const perMetric = mediaInsights[item.id] || [];
                  const perMetricByName = new Map(perMetric.map((m) => [m.name, metricValue(m)]));
                  return (
                    <div key={item.id} className={styles.mediaBlock}>
                      <button
                        type="button"
                        className={styles.mediaRow}
                        onClick={() => setExpandedMediaId(isExpanded ? null : item.id)}
                        aria-expanded={isExpanded}
                      >
                        {item.preview_url ? (
                          <Image src={item.preview_url} alt="" width={48} height={48} className={styles.mediaThumb} unoptimized />
                        ) : (
                          <div className={styles.mediaThumbFallback} aria-hidden="true" />
                        )}
                        <div className={styles.mediaMeta}>
                          <span className={styles.mediaCaption}>{item.caption ? item.caption.slice(0, 80) : <em>No caption</em>}</span>
                          <span className={styles.mediaSub}>
                            <Badge variant="neutral">{item.media_product_type || item.media_type || "POST"}</Badge>
                            {item.timestamp && <span>{new Date(item.timestamp).toLocaleDateString()}</span>}
                          </span>
                        </div>
                        <span className={styles.mediaQuickStat}>
                          {formatCompact(perMetricByName.get("reach") ?? 0)} reach
                        </span>
                      </button>
                      {isExpanded && (
                        <div className={styles.mediaDetail}>
                          {perMetric.length === 0 ? (
                            <p className={styles.hint}>No insights available for this post yet.</p>
                          ) : (
                            <InsightsBarChart
                              items={perMetric
                                .map((m) => ({ key: m.name, label: metricLabel(m.name, MEDIA_METRIC_LABELS), value: metricValue(m) }))
                                .filter((entry) => entry.value > 0)
                                .sort((a, b) => b.value - a.value)}
                              emptyLabel="No insights available for this post yet."
                            />
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            )}
          </Card>
        </>
      )}
    </div>
  );
}

function StatTile({ label, value }: { label: string; value: number | null }) {
  return (
    <Card className={styles.statTile}>
      <span className={styles.statLabel}>{label}</span>
      <span className={styles.statValue}>{value === null ? "-" : formatCompact(value)}</span>
    </Card>
  );
}
