"use client";

import type { InstagramPostType } from "@/lib/api";
import styles from "../InstagramPublishPanel.module.scss";

export interface PreviewMedia {
  key: string;
  previewUrl: string;
  isVideo: boolean;
}

interface PostPreviewProps {
  postType: InstagramPostType;
  username: string;
  caption: string;
  media: PreviewMedia[];
  activeIndex: number;
  onActiveIndexChange: (index: number) => void;
  /** Width / height the feed media will be published at. */
  ratio: number;
  /** Stories keep their own shape unless cropped to full screen. */
  fillFrame: boolean;
}

function MediaView({ item, fit }: { item: PreviewMedia; fit: "cover" | "contain" }) {
  if (item.isVideo) {
    return <video key={item.key} src={item.previewUrl} className={styles.previewMedia} style={{ objectFit: fit }} muted controls playsInline />;
  }
  // Local blob previews and bucket URLs: next/image adds nothing here.
  // eslint-disable-next-line @next/next/no-img-element
  return <img key={item.key} src={item.previewUrl} alt="" className={styles.previewMedia} style={{ objectFit: fit }} />;
}

/** Shows the draft the way it will appear on Instagram. */
export function PostPreview({ postType, username, caption, media, activeIndex, onActiveIndexChange, ratio, fillFrame }: PostPreviewProps) {
  const active = media[Math.min(activeIndex, media.length - 1)];
  const initial = username.charAt(0).toUpperCase() || "I";

  if (postType !== "feed") {
    return (
      <div className={styles.phone}>
        <div className={styles.tallFrame}>
          {active ? <MediaView item={active} fit={fillFrame ? "cover" : "contain"} /> : <span className={styles.previewEmpty}>Your {postType === "reel" ? "Reel" : "Story"} preview</span>}
          <div className={styles.tallHeader}>
            <span className={styles.previewAvatar}>{initial}</span>
            <span>{username}</span>
          </div>
          {postType === "reel" && caption && <p className={styles.tallCaption}>{caption}</p>}
        </div>
      </div>
    );
  }

  return (
    <div className={styles.phone}>
      <div className={styles.feedHeader}>
        <span className={styles.previewAvatar}>{initial}</span>
        <span className={styles.previewUsername}>{username}</span>
      </div>
      <div className={styles.feedMedia} style={{ aspectRatio: String(ratio) }}>
        {active ? <MediaView item={active} fit="cover" /> : <span className={styles.previewEmpty}>Your post preview</span>}
        {media.length > 1 && (
          <>
            <span className={styles.previewCount}>{activeIndex + 1}/{media.length}</span>
            {activeIndex > 0 && (
              <button type="button" className={styles.previewNav} data-side="left" onClick={() => onActiveIndexChange(activeIndex - 1)} aria-label="Previous">‹</button>
            )}
            {activeIndex < media.length - 1 && (
              <button type="button" className={styles.previewNav} data-side="right" onClick={() => onActiveIndexChange(activeIndex + 1)} aria-label="Next">›</button>
            )}
          </>
        )}
      </div>
      {media.length > 1 && (
        <div className={styles.previewDots}>
          {media.map((item, index) => (
            <span key={item.key} data-active={index === activeIndex || undefined} />
          ))}
        </div>
      )}
      <p className={styles.feedCaption}>
        <strong>{username}</strong> {caption || <span className={styles.previewPlaceholder}>Your caption will appear here.</span>}
      </p>
    </div>
  );
}
