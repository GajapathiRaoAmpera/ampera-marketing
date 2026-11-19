"use client";

import { useState } from "react";
import { messengerPageApi } from "@/lib/api";
import { useAsync } from "@/lib/hooks/useAsync";
import { EmptyState, Skeleton, Tabs } from "@/components/ui";
import { Section } from "@/components/features/messenger/MessengerShell";
import styles from "@/components/features/messenger/Messenger.module.scss";

type Range = "7" | "30" | "90";

function Stat({ value, label }: { value: string | number; label: string }) {
  return (
    <div className={styles.stat}>
      <strong>{value}</strong>
      <span>{label}</span>
    </div>
  );
}

function Analytics({ pageId }: { pageId: string }) {
  const [range, setRange] = useState<Range>("30");
  const { data, isLoading, error } = useAsync(() => messengerPageApi.analytics(pageId, Number(range)), [pageId, range]);
  const peak = Math.max(1, ...(data?.new_per_day ?? []).map((day) => day.count));
  const topSource = Math.max(1, ...(data?.sources ?? []).map((source) => source.people));
  const hot = (data?.leads.hot ?? 0) + (data?.leads.very_hot ?? 0);

  return (
    <>
      <Tabs<Range>
        options={[{ value: "7", label: "7 days" }, { value: "30", label: "30 days" }, { value: "90", label: "90 days" }]}
        value={range}
        onChange={setRange}
      />
      {isLoading ? (
        <Skeleton height={280} />
      ) : !data ? (
        <EmptyState title="Couldn't load analytics" description={error ?? "Please try again."} />
      ) : (
        <>
          <div className={styles.statGrid}>
            <Stat value={data.new_contacts} label="New people" />
            <Stat value={hot} label="Hot leads" />
            <Stat value={data.avg_response_seconds === null ? "–" : `${data.avg_response_seconds}s`} label="Average reply time" />
            <Stat value={data.open_windows} label="Can be messaged now" />
            <Stat value={data.missed_windows} label="Left unanswered" />
            <Stat value={data.subscribers} label="Subscribers" />
            <Stat value={data.callbacks_waiting} label="Waiting for a callback" />
            <Stat value={data.avg_rating === null ? "–" : `${data.avg_rating} ★`} label={`Rating (${data.ratings_count})`} />
          </div>

          <Section title="New people per day">
            <div className={styles.bars} role="img" aria-label="New people per day">
              {data.new_per_day.map((day) => (
                <span key={day.date} style={{ height: `${(day.count / peak) * 100}%` }} title={`${day.date}: ${day.count}`} />
              ))}
            </div>
            <div className={styles.barAxis}>
              <span>{data.new_per_day[0]?.date}</span>
              <span>{data.new_per_day[data.new_per_day.length - 1]?.date}</span>
            </div>
          </Section>

          <Section title="Where people came from" hint="Links, QR codes and ads you track show up by name.">
            {data.sources.length === 0 ? (
              <p className={styles.hint}>No new people in this period.</p>
            ) : (
              data.sources.map((source) => (
                <div key={source.name}>
                  <div className={styles.rowMeta}>
                    <strong>{source.name}</strong>
                    <span>{source.people} people</span>
                    <span>{source.hot_leads} hot leads</span>
                  </div>
                  <div className={styles.sourceBar}>
                    <span style={{ width: `${(source.people / topSource) * 100}%` }} />
                  </div>
                </div>
              ))
            )}
          </Section>
        </>
      )}
    </>
  );
}

export function AnalyticsTab({ pageId }: { pageId: string }) {
  return <Analytics pageId={pageId} />;
}
