"use client";

import { useMemo, useState } from "react";
import type { InstagramPost } from "@/lib/api";
import { Badge, Button, Card, EmptyState } from "@/components/ui";
import { POST_TYPE_LABEL, formatDateTime } from "./helpers";
import styles from "../InstagramPublishPanel.module.scss";

function PostThumb({ post }: { post: InstagramPost }) {
  const first = post.media[0];
  if (!first) return <div className={styles.rowThumb} />;
  return (
    <div className={styles.rowThumb}>
      {first.is_video ? (
        <video src={first.url} muted preload="metadata" />
      ) : (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={first.url} alt="" loading="lazy" />
      )}
      {post.media.length > 1 && <span className={styles.thumbIndex}>{post.media.length}</span>}
    </div>
  );
}

interface PostListProps {
  posts: InstagramPost[];
  emptyTitle: string;
  emptyDescription: string;
  /** Id of the post an action is currently running on. */
  busyId: string | null;
  onEdit: (post: InstagramPost) => void;
  onPublishNow: (post: InstagramPost) => void;
  onDelete: (post: InstagramPost) => void;
}

export function PostList({ posts, emptyTitle, emptyDescription, busyId, onEdit, onPublishNow, onDelete }: PostListProps) {
  if (posts.length === 0) {
    return <EmptyState title={emptyTitle} description={emptyDescription} />;
  }

  return (
    <Card padding="none">
      {posts.map((post) => {
        const isBusy = busyId === post.id;
        return (
          <div key={post.id} className={styles.postRow}>
            <PostThumb post={post} />
            <div className={styles.rowBody}>
              <p className={styles.rowCaption}>{post.caption || <span className={styles.previewPlaceholder}>No caption</span>}</p>
              <div className={styles.rowMeta}>
                <Badge variant="neutral">{POST_TYPE_LABEL[post.post_type]}</Badge>
                {post.status === "scheduled" && <span>Goes out {formatDateTime(post.scheduled_at)}</span>}
                {post.status === "draft" && <span>Edited {formatDateTime(post.updated_at)}</span>}
                {post.status === "publishing" && <Badge variant="info">Publishing…</Badge>}
                {post.status === "failed" && <Badge variant="danger">Failed</Badge>}
                {post.status === "published" && (
                  <>
                    <span>Published {formatDateTime(post.published_at)}</span>
                    {typeof post.like_count === "number" && <span>♥ {post.like_count}</span>}
                    {typeof post.comments_count === "number" && <span>💬 {post.comments_count}</span>}
                  </>
                )}
              </div>
              {post.status === "failed" && post.error && <p className={styles.errorText}>{post.error}</p>}
              {(post.warnings ?? []).map((warning) => (
                <p key={warning} className={styles.warningText}>{warning}</p>
              ))}
            </div>
            <div className={styles.rowActions}>
              {post.status === "published" && post.permalink && (
                <Button size="sm" variant="secondary" onClick={() => window.open(post.permalink ?? "", "_blank", "noopener,noreferrer")}>View</Button>
              )}
              {post.status === "failed" && (
                <Button size="sm" variant="primary" isLoading={isBusy} onClick={() => onPublishNow(post)}>Retry</Button>
              )}
              {post.status === "scheduled" && (
                <Button size="sm" variant="secondary" isLoading={isBusy} onClick={() => onPublishNow(post)}>Publish now</Button>
              )}
              {post.status !== "published" && post.status !== "publishing" && (
                <Button size="sm" variant="secondary" disabled={isBusy} onClick={() => onEdit(post)}>Edit</Button>
              )}
              {post.status !== "publishing" && (
                <Button size="sm" variant="ghost" disabled={isBusy} onClick={() => onDelete(post)}>
                  {post.status === "scheduled" ? "Cancel" : post.status === "published" ? "Hide" : "Delete"}
                </Button>
              )}
            </div>
          </div>
        );
      })}
    </Card>
  );
}

const WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const dayKey = (date: Date) => `${date.getFullYear()}-${date.getMonth()}-${date.getDate()}`;

/** Month view of everything scheduled or already published. */
export function PostCalendar({ posts, onEdit }: { posts: InstagramPost[]; onEdit: (post: InstagramPost) => void }) {
  const [month, setMonth] = useState(() => {
    const now = new Date();
    return new Date(now.getFullYear(), now.getMonth(), 1);
  });

  const byDay = useMemo(() => {
    const map = new Map<string, Array<{ post: InstagramPost; when: Date }>>();
    for (const post of posts) {
      const iso = post.status === "scheduled" ? post.scheduled_at : post.status === "published" ? post.published_at : null;
      if (!iso) continue;
      const when = new Date(iso);
      const key = dayKey(when);
      map.set(key, [...(map.get(key) ?? []), { post, when }]);
    }
    map.forEach((entries) => entries.sort((a, b) => a.when.getTime() - b.when.getTime()));
    return map;
  }, [posts]);

  const days = useMemo(() => {
    const start = new Date(month);
    start.setDate(1 - start.getDay());
    const weeks = Math.ceil((month.getDay() + new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()) / 7);
    return Array.from({ length: weeks * 7 }, (_, index) => new Date(start.getFullYear(), start.getMonth(), start.getDate() + index));
  }, [month]);

  const todayKey = dayKey(new Date());
  const shiftMonth = (delta: number) => setMonth((current) => new Date(current.getFullYear(), current.getMonth() + delta, 1));

  return (
    <Card>
      <div className={styles.calendarHead}>
        <strong>{month.toLocaleDateString(undefined, { month: "long", year: "numeric" })}</strong>
        <div className={styles.calendarNav}>
          <Button size="sm" variant="secondary" onClick={() => shiftMonth(-1)} aria-label="Previous month">‹</Button>
          <Button size="sm" variant="secondary" onClick={() => setMonth(new Date(new Date().getFullYear(), new Date().getMonth(), 1))}>Today</Button>
          <Button size="sm" variant="secondary" onClick={() => shiftMonth(1)} aria-label="Next month">›</Button>
        </div>
      </div>
      <div className={styles.calendarScroll}>
        <div className={styles.calendarGrid}>
          {WEEKDAYS.map((name) => (
            <div key={name} className={styles.calendarWeekday}>{name}</div>
          ))}
          {days.map((date) => {
            const entries = byDay.get(dayKey(date)) ?? [];
            return (
              <div
                key={date.toISOString()}
                className={styles.calendarDay}
                data-outside={date.getMonth() !== month.getMonth() || undefined}
                data-today={dayKey(date) === todayKey || undefined}
              >
                <span className={styles.calendarDate}>{date.getDate()}</span>
                {entries.slice(0, 3).map(({ post, when }) => (
                  <button
                    key={post.id}
                    type="button"
                    className={styles.calendarEvent}
                    data-status={post.status}
                    title={post.caption || POST_TYPE_LABEL[post.post_type]}
                    onClick={() => (post.status === "scheduled" ? onEdit(post) : post.permalink && window.open(post.permalink, "_blank", "noopener,noreferrer"))}
                  >
                    {when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })} · {POST_TYPE_LABEL[post.post_type]}
                  </button>
                ))}
                {entries.length > 3 && <span className={styles.hint}>+{entries.length - 3} more</span>}
              </div>
            );
          })}
        </div>
      </div>
      <div className={styles.calendarLegend}>
        <span data-status="scheduled">Scheduled</span>
        <span data-status="published">Published</span>
      </div>
    </Card>
  );
}
