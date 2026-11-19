"use client";

import { useEffect, useState } from "react";
import { notificationsApi } from "@/lib/api";
import { IconTile } from "@/components/ui/Icon/Icon";
import { formatDateTime, formatRelativeTime, parseServerDate } from "@/lib/utils/date";
import { dayLabel, notificationMeta } from "@/lib/utils/notification-meta";
import type { ActivityFeedItem, AuditLogEntry, Notification } from "@/types/api";
import styles from "./ActivityFeedDropdown.module.scss";

type Tab = "all" | "unread" | "changes";

interface ActivityFeedDropdownProps {
  /** Live list kept up to date by the bell; null while the first load runs. */
  items: Notification[] | null;
  unreadCount: number;
  onOpenItem: (item: Notification, href: string | null) => void;
  onMarkAllRead: () => void;
}

export function ActivityFeedDropdown({ items, unreadCount, onOpenItem, onMarkAllRead }: ActivityFeedDropdownProps) {
  const [tab, setTab] = useState<Tab>("all");
  const [changes, setChanges] = useState<AuditLogEntry[] | null>(null);
  // Re-render every 30s so "2m ago" stays true while the panel is open.
  const [, setTick] = useState(0);

  useEffect(() => {
    const timer = window.setInterval(() => setTick((t) => t + 1), 30000);
    return () => window.clearInterval(timer);
  }, []);

  useEffect(() => {
    if (tab !== "changes" || changes !== null) return;
    let cancelled = false;
    notificationsApi
      .activityFeed()
      .then((feed: ActivityFeedItem[]) => {
        if (!cancelled) setChanges(feed.filter((item) => item.source === "audit_log") as unknown as AuditLogEntry[]);
      })
      .catch(() => !cancelled && setChanges([]));
    return () => {
      cancelled = true;
    };
  }, [tab, changes]);

  const shown = (items ?? []).filter((item) => tab !== "unread" || !item.read);
  let lastDay = "";

  return (
    <div className={styles.dropdown} role="dialog" aria-label="Notifications">
      <div className={styles.header}>
        <span className={styles.title}>
          Notifications
          <span className={styles.liveDot} title="Updates live" aria-hidden />
        </span>
        {unreadCount > 0 && (
          <button type="button" className={styles.markAllButton} onClick={onMarkAllRead}>
            Mark all read
          </button>
        )}
      </div>

      <div className={styles.tabs} role="tablist">
        {(
          [
            ["all", "All"],
            ["unread", `Unread${unreadCount ? ` (${unreadCount})` : ""}`],
            ["changes", "Changes"],
          ] as Array<[Tab, string]>
        ).map(([value, label]) => (
          <button key={value} type="button" role="tab" aria-selected={tab === value} className={tab === value ? styles.tabOn : styles.tab} onClick={() => setTab(value)}>
            {label}
          </button>
        ))}
      </div>

      <div className={styles.list}>
        {tab === "changes" ? (
          changes === null ? (
            <div className={styles.empty}>Loading…</div>
          ) : changes.length === 0 ? (
            <div className={styles.empty}>No settings changes yet.</div>
          ) : (
            changes.map((entry) => (
              <div key={entry.id} className={styles.item}>
                <IconTile name="gear" tone="slate" size="sm" />
                <span className={styles.itemBody}>
                  <span className={styles.itemTitle}>{entry.summary}</span>
                  <span className={styles.itemTime} title={formatDateTime(entry.created_at)}>
                    {formatRelativeTime(entry.created_at)}
                  </span>
                </span>
              </div>
            ))
          )
        ) : items === null ? (
          <div className={styles.empty}>Loading…</div>
        ) : shown.length === 0 ? (
          <div className={styles.empty}>
            {tab === "unread" ? "You're all caught up." : "Nothing yet. New messages, alerts and questions your AI couldn't answer show up here the moment they happen."}
          </div>
        ) : (
          shown.map((item) => {
            const meta = notificationMeta(item);
            const day = dayLabel(item.created_at);
            const heading = day !== lastDay ? day : null;
            lastDay = day;
            return (
              <div key={item.id}>
                {heading && <div className={styles.day}>{heading}</div>}
                <button type="button" className={styles.item} data-unread={!item.read} onClick={() => onOpenItem(item, meta.href)}>
                  <IconTile name={meta.icon} tone={meta.tone} size="sm" />
                  <span className={styles.itemBody}>
                    <span className={styles.itemTitle}>{item.title}</span>
                    {item.body && <span className={styles.itemDescription}>{item.body}</span>}
                    <span className={styles.itemTime} title={formatDateTime(item.created_at)}>
                      {formatRelativeTime(item.created_at)} · {parseServerDate(item.created_at).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" })}
                    </span>
                  </span>
                  {!item.read && <span className={styles.unreadDot} aria-label="Unread" />}
                </button>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
