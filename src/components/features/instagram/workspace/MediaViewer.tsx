"use client";

import { useEffect, useRef, useState, type ReactNode } from "react";
import { createPortal } from "react-dom";
import type { InstagramMedia } from "@/lib/api";
import { Icon } from "./icons";
import { KIND_LABEL, isStory, isVideo, mediaKind, mediaPreview, shortDate, slidesOf } from "./media";
import styles from "./viewer.module.scss";

interface MediaStageProps {
  item: InstagramMedia;
  /** Start videos playing as soon as they are shown. */
  autoPlay?: boolean;
  compact?: boolean;
}

/**
 * The post itself: a photo, a playable Reel or video, or a carousel you can
 * swipe through (arrows, dots, keyboard and touch).
 */
export function MediaStage({ item, autoPlay = false, compact = false }: MediaStageProps) {
  const slides = slidesOf(item);
  const [index, setIndex] = useState(0);
  const touchStart = useRef<number | null>(null);
  const kind = mediaKind(item);
  const current = slides[Math.min(index, slides.length - 1)];
  const many = slides.length > 1;

  function go(step: number) {
    setIndex((value) => Math.max(0, Math.min(slides.length - 1, value + step)));
  }

  return (
    <div
      className={`${styles.stage} ${kind === "reel" || isStory(item) ? styles.stageTall : ""} ${compact ? styles.stageCompact : ""}`}
      onTouchStart={(event) => {
        touchStart.current = event.touches[0]?.clientX ?? null;
      }}
      onTouchEnd={(event) => {
        if (touchStart.current === null || !many) return;
        const delta = (event.changedTouches[0]?.clientX ?? 0) - touchStart.current;
        if (Math.abs(delta) > 40) go(delta < 0 ? 1 : -1);
        touchStart.current = null;
      }}
      onKeyDown={(event) => {
        if (event.key === "ArrowRight") go(1);
        if (event.key === "ArrowLeft") go(-1);
      }}
      tabIndex={many ? 0 : -1}
      aria-roledescription={many ? "carousel" : undefined}
    >
      {isVideo(current) && current.media_url ? (
        <video
          key={current.id}
          className={styles.stageMedia}
          src={current.media_url}
          poster={current.thumbnail_url}
          controls
          playsInline
          autoPlay={autoPlay}
          muted={autoPlay}
          loop={kind === "reel"}
          preload="metadata"
        />
      ) : mediaPreview(current) ? (
        // eslint-disable-next-line @next/next/no-img-element
        <img key={current.id} className={styles.stageMedia} src={mediaPreview(current)} alt={item.caption?.slice(0, 120) || "Instagram post"} />
      ) : (
        <div className={styles.stageEmpty}>Preview not available</div>
      )}

      <span className={styles.kindTag}>{isStory(item) ? "Story" : KIND_LABEL[kind]}</span>

      {many && (
        <>
          <span className={styles.counter}>
            {index + 1}/{slides.length}
          </span>
          {index > 0 && (
            <button type="button" className={`${styles.arrow} ${styles.arrowLeft}`} onClick={() => go(-1)} aria-label="Previous slide">
              ‹
            </button>
          )}
          {index < slides.length - 1 && (
            <button type="button" className={`${styles.arrow} ${styles.arrowRight}`} onClick={() => go(1)} aria-label="Next slide">
              ›
            </button>
          )}
          <div className={styles.dots}>
            {slides.map((slide, i) => (
              <button
                key={slide.id}
                type="button"
                className={i === index ? styles.dotActive : styles.dot}
                onClick={() => setIndex(i)}
                aria-label={`Slide ${i + 1}`}
              />
            ))}
          </div>
        </>
      )}
    </div>
  );
}

interface MediaViewerProps {
  item: InstagramMedia | null;
  onClose: () => void;
  username?: string;
  avatarUrl?: string | null;
  /** Extra content beside the post: stats, automations, etc. */
  children?: ReactNode;
  /** The main actions, pinned to the bottom of the side panel. */
  actions?: ReactNode;
}

/** Full-screen view of one post, laid out like Instagram's own post view. */
export function MediaViewer({ item, onClose, username, avatarUrl, children, actions }: MediaViewerProps) {
  useEffect(() => {
    if (!item) return;
    const previous = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => {
      document.body.style.overflow = previous;
      window.removeEventListener("keydown", onKey);
    };
  }, [item, onClose]);

  if (!item || typeof document === "undefined") return null;

  return createPortal(
    <div className={styles.overlay} onClick={onClose} role="presentation">
      <div className={styles.viewer} role="dialog" aria-modal="true" aria-label="Post preview" onClick={(event) => event.stopPropagation()}>
        <button type="button" className={styles.close} onClick={onClose} aria-label="Close">
          ×
        </button>
        <div className={styles.viewerStage}>
          <MediaStage key={item.id} item={item} autoPlay />
        </div>
        <aside className={styles.side}>
          <header className={styles.sideHeader}>
            {avatarUrl ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img className={styles.sideAvatar} src={avatarUrl} alt="" />
            ) : (
              <span className={styles.sideAvatarFallback} aria-hidden>
                {(username || "?").slice(0, 1).toUpperCase()}
              </span>
            )}
            <div className={styles.sideWho}>
              <strong>{username ? `@${username}` : "Your post"}</strong>
              <span>
                {isStory(item) ? "Story" : KIND_LABEL[mediaKind(item)]} · {shortDate(item.timestamp)}
              </span>
            </div>
            {item.permalink && (
              <a className={styles.openLink} href={item.permalink} target="_blank" rel="noreferrer">
                Open on Instagram <Icon name="external" size={13} />
              </a>
            )}
          </header>
          <div className={styles.sideBody}>
            {item.caption ? <p className={styles.caption}>{item.caption}</p> : <p className={styles.captionEmpty}>No caption</p>}
            <div className={styles.engagement}>
              <span>
                <Icon name="heart" size={16} /> {item.like_count ?? "–"} likes
              </span>
              <span>
                <Icon name="comment" size={16} /> {item.comments_count ?? 0} comments
              </span>
            </div>
            {children}
          </div>
          {actions && <footer className={styles.sideActions}>{actions}</footer>}
        </aside>
      </div>
    </div>,
    document.body
  );
}
