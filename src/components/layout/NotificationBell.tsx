"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { notificationsApi } from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import type { Notification } from "@/types/api";
import { BellIcon } from "./icons";
import { ActivityFeedDropdown } from "./ActivityFeedDropdown";
import styles from "./NotificationBell.module.scss";

// Often enough to feel live, cheap enough to run all day: one indexed query,
// and nothing at all while the tab is in the background.
const POLL_MS = 5000;

/**
 * The bell: shows the unread count, pops a toast the moment something new
 * happens, and keeps the open list up to date as notifications arrive.
 */
export function NotificationBell() {
  const router = useRouter();
  const { show } = useToast();
  const [isOpen, setIsOpen] = useState(false);
  const [unreadCount, setUnreadCount] = useState(0);
  const [items, setItems] = useState<Notification[] | null>(null);
  const [pulse, setPulse] = useState(false);
  const wrapRef = useRef<HTMLDivElement>(null);
  // Newest notification already shown; the poll asks only for newer ones.
  const sinceRef = useRef<string | null>(null);
  const showRef = useRef(show);
  useEffect(() => {
    showRef.current = show;
  }, [show]);

  const merge = useCallback((fresh: Notification[]) => {
    if (fresh.length === 0) return;
    setItems((current) => {
      const known = new Set((current ?? []).map((item) => item.id));
      const added = fresh.filter((item) => !known.has(item.id));
      return added.length ? [...added, ...(current ?? [])].slice(0, 100) : current;
    });
    const newest = fresh.reduce((latest, item) => (item.created_at > latest ? item.created_at : latest), sinceRef.current ?? "");
    sinceRef.current = newest || sinceRef.current;
  }, []);

  useEffect(() => {
    let cancelled = false;

    async function start() {
      try {
        const [list, count] = await Promise.all([notificationsApi.list(false, 50), notificationsApi.unreadCount()]);
        if (cancelled) return;
        setItems(list);
        setUnreadCount(count);
        sinceRef.current = list[0]?.created_at ?? new Date().toISOString();
      } catch {
        if (!cancelled) setItems((current) => current ?? []);
      }
    }

    async function poll() {
      if (document.visibilityState !== "visible" || !sinceRef.current) return;
      try {
        const result = await notificationsApi.updates(sinceRef.current);
        if (cancelled) return;
        setUnreadCount(result.unread_count);
        if (result.notifications.length) {
          merge(result.notifications);
          setPulse(true);
          window.setTimeout(() => setPulse(false), 1200);
          // A toast for what just happened (at most two at once).
          result.notifications.slice(0, 2).forEach((item) => showRef.current(`${item.title}: ${item.body}`, "default"));
        }
      } catch {
        // A failed poll keeps what is on screen; the next one catches up.
      }
    }

    void start();
    const timer = window.setInterval(() => void poll(), POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") void poll();
    };
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", onVisible);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", onVisible);
    };
  }, [merge]);

  useEffect(() => {
    if (!isOpen) return;
    function handleClickOutside(e: MouseEvent) {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setIsOpen(false);
    }
    function handleKey(e: KeyboardEvent) {
      if (e.key === "Escape") setIsOpen(false);
    }
    document.addEventListener("mousedown", handleClickOutside);
    document.addEventListener("keydown", handleKey);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
      document.removeEventListener("keydown", handleKey);
    };
  }, [isOpen]);

  async function markRead(item: Notification) {
    if (item.read) return;
    setItems((current) => current?.map((n) => (n.id === item.id ? { ...n, read: true } : n)) ?? current);
    setUnreadCount((count) => Math.max(0, count - 1));
    try {
      await notificationsApi.markRead(item.id);
    } catch {
      // The next poll corrects the count if this didn't stick.
    }
  }

  async function markAllRead() {
    setItems((current) => current?.map((n) => ({ ...n, read: true })) ?? current);
    setUnreadCount(0);
    try {
      await notificationsApi.markAllRead();
    } catch {
      // As above.
    }
  }

  return (
    <div className={styles.wrap} ref={wrapRef}>
      <button
        type="button"
        className={`${styles.button} ${pulse ? styles.ring : ""} ${isOpen ? styles.buttonOpen : ""}`}
        onClick={() => setIsOpen((open) => !open)}
        aria-label={unreadCount > 0 ? `Notifications (${unreadCount} unread)` : "Notifications"}
        aria-expanded={isOpen}
      >
        <BellIcon size={18} />
        {unreadCount > 0 && <span className={styles.badge}>{unreadCount > 99 ? "99+" : unreadCount}</span>}
      </button>

      {isOpen && (
        <ActivityFeedDropdown
          items={items}
          unreadCount={unreadCount}
          onOpenItem={(item, href) => {
            void markRead(item);
            if (href) {
              setIsOpen(false);
              router.push(href);
            }
          }}
          onMarkAllRead={() => void markAllRead()}
        />
      )}
    </div>
  );
}
