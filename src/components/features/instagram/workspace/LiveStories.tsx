"use client";

import { useCallback, useEffect, useState } from "react";
import { ApiError, instagramAutomationsApi, type InstagramMedia } from "@/lib/api";
import { Button, Skeleton } from "@/components/ui";
import { mediaPreview, storyMsLeft, storyTimeLeft } from "./media";
import styles from "./stories.module.scss";

const TICK_MS = 30_000;
const RELOAD_MS = 5 * 60_000;

function useNow(): number {
  const [now, setNow] = useState(() => Date.now());
  useEffect(() => {
    const timer = window.setInterval(() => setNow(Date.now()), TICK_MS);
    return () => window.clearInterval(timer);
  }, []);
  return now;
}

/** Active with the time left, or Ended once the 24 hours are up. */
export function StoryCountdown({ item }: { item: InstagramMedia }) {
  const now = useNow();
  const left = storyMsLeft(item, now);
  const ended = left !== null && left <= 0;
  return (
    <span className={ended ? styles.ended : styles.active}>
      {!ended && <span className={styles.dot} aria-hidden />}
      {ended ? "Ended" : left === null ? "Active" : storyTimeLeft(left)}
    </span>
  );
}

/** Stories live right now. They leave the row as soon as they end. */
export function LiveStories({ businessId, connectionId, onOpen }: { businessId: string; connectionId: string; onOpen: (item: InstagramMedia) => void }) {
  const [stories, setStories] = useState<InstagramMedia[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const now = useNow();

  const load = useCallback(() => {
    instagramAutomationsApi
      .stories(businessId, connectionId)
      .then((result) => {
        setStories(result.data || []);
        setError(null);
      })
      .catch((err) => setError(err instanceof ApiError ? err.userMessage : "Couldn't load your Stories from Instagram."));
  }, [businessId, connectionId]);

  useEffect(() => {
    load();
    const timer = window.setInterval(load, RELOAD_MS);
    return () => window.clearInterval(timer);
  }, [load]);

  const live = (stories ?? []).filter((item) => (storyMsLeft(item, now) ?? 1) > 0);

  return (
    <section className={styles.section} aria-label="Live Stories">
      <div className={styles.head}>
        <h3>Stories</h3>
        {stories !== null && !error && (
          <span className={live.length > 0 ? styles.active : styles.ended}>
            {live.length > 0 && <span className={styles.dot} aria-hidden />}
            {live.length > 0 ? `${live.length} active` : "None active"}
          </span>
        )}
      </div>
      {error ? (
        <div className={styles.note}>
          <span>{error}</span>
          <Button size="sm" variant="secondary" onClick={load}>
            Try again
          </Button>
        </div>
      ) : stories === null ? (
        <Skeleton height={150} width={96} />
      ) : live.length === 0 ? (
        <p className={styles.note}>No Stories are live right now. A new one shows up here for its 24 hours.</p>
      ) : (
        <div className={styles.row}>
          {live.map((item) => {
            const preview = mediaPreview(item);
            return (
              <button key={item.id} type="button" className={styles.tile} onClick={() => onOpen(item)}>
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className={styles.noPreview}>Story</span>
                )}
                <span className={styles.badge}>
                  <StoryCountdown item={item} />
                </span>
              </button>
            );
          })}
        </div>
      )}
    </section>
  );
}
