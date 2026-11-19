"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { ApiError, instagramAutomationsApi, type InstagramMedia, type InstagramMediaKind } from "@/lib/api";
import { Button, Skeleton } from "@/components/ui";
import { Icon } from "./icons";
import { KIND_LABEL, mediaKind, mediaPreview, shortDate } from "./media";
import styles from "./browser.module.scss";

const FILTERS: Array<{ value: InstagramMediaKind | "all"; label: string }> = [
  { value: "all", label: "Everything" },
  { value: "post", label: "Photos" },
  { value: "reel", label: "Reels" },
  { value: "carousel", label: "Carousels" },
];

const PAGE_SIZES = [12, 24, 48];

interface MediaBrowserProps {
  businessId: string;
  connectionId: string;
  /** Clicking a tile. */
  onOpen: (item: InstagramMedia) => void;
  selectedIds?: string[];
  /** Small overlay drawn on each tile, e.g. comment numbers. */
  renderOverlay?: (item: InstagramMedia) => ReactNode;
  /** Called with every page shown, so a parent can load data for it. */
  onPage?: (items: InstagramMedia[]) => void;
}

type Page = { items: InstagramMedia[]; next: string | null };

/**
 * The account's posts, a page at a time. Choose what to show and how many,
 * then step through with Previous / Next. Pages already seen are kept, so
 * going back is instant.
 */
export function MediaBrowser({ businessId, connectionId, onOpen, selectedIds = [], renderOverlay, onPage }: MediaBrowserProps) {
  const [kind, setKind] = useState<InstagramMediaKind | "all">("all");
  const [pageSize, setPageSize] = useState(12);
  // Cursor that starts each page we've visited; index 0 is the first page.
  const [cursors, setCursors] = useState<Array<string | null>>([null]);
  const [pageIndex, setPageIndex] = useState(0);
  // Every page loaded so far, by what was asked for: going back is instant.
  const [pages, setPages] = useState<Record<string, Page>>({});
  const [errors, setErrors] = useState<Record<string, string>>({});
  // The last page shown, kept on screen while the next one loads.
  const [shown, setShown] = useState<Page | null>(null);
  const [attempt, setAttempt] = useState(0);
  const requested = useRef(new Set<string>());

  const cursor = cursors[pageIndex] ?? null;
  const key = `${connectionId}|${kind}|${pageSize}|${cursor ?? ""}`;
  const current = pages[key];
  const error = errors[key] ?? null;
  const loading = !current && !error;
  const page = current ?? shown;

  useEffect(() => {
    if (requested.current.has(key)) return;
    requested.current.add(key);
    let cancelled = false;
    instagramAutomationsApi
      .media(businessId, connectionId, { kind: kind === "all" ? undefined : kind, after: cursor, limit: pageSize })
      .then((result) => {
        const next = result.paging?.next ? result.paging?.cursors?.after ?? null : null;
        const loaded: Page = { items: result.data || [], next };
        setPages((all) => ({ ...all, [key]: loaded }));
        if (!cancelled) setShown(loaded);
      })
      .catch((err) => {
        requested.current.delete(key);
        setErrors((all) => ({ ...all, [key]: err instanceof ApiError ? err.userMessage : "Couldn't load your posts from Instagram." }));
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, connectionId, kind, pageSize, cursor, key, attempt]);

  useEffect(() => {
    if (current) onPage?.(current.items);
  }, [current, onPage]);

  function retry() {
    setErrors((all) => {
      const copy = { ...all };
      delete copy[key];
      return copy;
    });
    setAttempt((value) => value + 1);
  }

  function resetTo(nextKind: typeof kind, nextSize: number) {
    setKind(nextKind);
    setPageSize(nextSize);
    setCursors([null]);
    setPageIndex(0);
  }

  function goNext() {
    if (!nextCursor) return;
    setCursors((list) => [...list.slice(0, pageIndex + 1), nextCursor]);
    setPageIndex((value) => value + 1);
  }

  const items = page?.items ?? [];
  const nextCursor = current?.next ?? null;
  const first = pageIndex * pageSize + 1;

  return (
    <div className={styles.browser}>
      <div className={styles.toolbar}>
        <div className={styles.filters} role="tablist" aria-label="Show">
          {FILTERS.map((filter) => (
            <button
              key={filter.value}
              type="button"
              role="tab"
              aria-selected={kind === filter.value}
              className={kind === filter.value ? styles.filterActive : styles.filter}
              onClick={() => resetTo(filter.value, pageSize)}
            >
              {filter.label}
            </button>
          ))}
        </div>
        <label className={styles.pageSize}>
          <span>Show</span>
          <select value={pageSize} onChange={(event) => resetTo(kind, Number(event.target.value))}>
            {PAGE_SIZES.map((size) => (
              <option key={size} value={size}>
                {size} per page
              </option>
            ))}
          </select>
        </label>
      </div>

      {error ? (
        <div className={styles.error}>
          <span>{error}</span>
          <Button size="sm" variant="secondary" onClick={retry}>
            Try again
          </Button>
        </div>
      ) : loading && !page ? (
        <div className={styles.grid}>
          {Array.from({ length: Math.min(pageSize, 12) }).map((_, i) => (
            <Skeleton key={i} height={0} className={styles.skeletonTile} />
          ))}
        </div>
      ) : items.length === 0 ? (
        <div className={styles.empty}>
          {kind === "all" ? "No posts on this account yet." : `No ${FILTERS.find((f) => f.value === kind)?.label.toLowerCase()} here.`}
        </div>
      ) : (
        <div className={`${styles.grid} ${loading ? styles.gridLoading : ""}`} aria-busy={loading}>
          {items.map((item) => {
            const selected = selectedIds.includes(item.id);
            const itemKind = mediaKind(item);
            const preview = mediaPreview(item);
            return (
              <button
                type="button"
                key={item.id}
                className={`${styles.tile} ${selected ? styles.tileSelected : ""}`}
                onClick={() => onOpen(item)}
                aria-pressed={selectedIds.length ? selected : undefined}
                title={item.caption?.slice(0, 120) || KIND_LABEL[itemKind]}
              >
                {preview ? (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={preview} alt="" loading="lazy" decoding="async" />
                ) : (
                  <span className={styles.noPreview}>{KIND_LABEL[itemKind]}</span>
                )}
                <span className={styles.kindIcon} aria-label={KIND_LABEL[itemKind]}>
                  {itemKind === "reel" || itemKind === "video" ? <Icon name="play" size={18} style={{ fill: "currentColor" }} /> : itemKind === "carousel" ? <Icon name="carousel" size={18} /> : null}
                </span>
                {selected && (
                  <span className={styles.check} aria-hidden>
                    <Icon name="check" size={15} style={{ strokeWidth: 3 }} />
                  </span>
                )}
                <span className={styles.tileFoot}>
                  {renderOverlay ? renderOverlay(item) : (
                    <>
                      <span className={styles.stat}>
                        <Icon name="comment" size={13} /> {item.comments_count ?? 0}
                      </span>
                      <span>{shortDate(item.timestamp)}</span>
                    </>
                  )}
                </span>
              </button>
            );
          })}
        </div>
      )}

      {(pageIndex > 0 || nextCursor) && !error && (
        <div className={styles.pager}>
          <Button variant="secondary" size="sm" disabled={pageIndex === 0 || loading} onClick={() => setPageIndex((v) => v - 1)}>
            ← Previous
          </Button>
          <span className={styles.pagerText}>
            {items.length > 0 ? `${first}–${first + items.length - 1}` : ""} · Page {pageIndex + 1}
          </span>
          <Button variant="secondary" size="sm" disabled={!nextCursor || loading} isLoading={loading && Boolean(page)} onClick={goNext}>
            Next →
          </Button>
        </div>
      )}
    </div>
  );
}
