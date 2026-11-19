import { ApiError, type InstagramMedia, type InstagramMediaChild, type InstagramMediaKind } from "@/lib/api";

/** A message to show for a failed request. An automation that can't go live
 * yet comes back as { valid, errors }, so its first error is used. */
export function apiErrorMessage(error: unknown, fallback: string): string {
  if (!(error instanceof ApiError)) return fallback;
  const detail = error.detail;
  if (detail && typeof detail === "object" && "errors" in detail) {
    const first = (detail as { errors?: string[] }).errors?.[0];
    if (first) return first;
  }
  return error.userMessage || fallback;
}

/** post | reel | carousel | video, the way people think about their content. */
export function mediaKind(item: Pick<InstagramMedia, "media_type" | "media_product_type">): InstagramMediaKind {
  const product = (item.media_product_type || "").toUpperCase();
  const type = (item.media_type || "").toUpperCase();
  if (product === "REELS" || product === "REEL") return "reel";
  if (type === "CAROUSEL_ALBUM") return "carousel";
  if (type === "VIDEO") return "video";
  return "post";
}

export const KIND_LABEL: Record<InstagramMediaKind, string> = {
  post: "Post",
  reel: "Reel",
  carousel: "Carousel",
  video: "Video",
};

export function mediaPreview(item: InstagramMedia | InstagramMediaChild): string | undefined {
  return item.preview_url || item.thumbnail_url || item.media_url;
}

/** Stories stay up for 24 hours. */
const STORY_LIFE_MS = 24 * 60 * 60 * 1000;

/** Milliseconds until a Story ends, or null if Instagram gave no time. */
export function storyMsLeft(item: Pick<InstagramMedia, "timestamp">, now: number): number | null {
  const posted = item.timestamp ? new Date(item.timestamp.replace(/([+-]\d{2})(\d{2})$/, "$1:$2")).getTime() : NaN;
  return Number.isNaN(posted) ? null : posted + STORY_LIFE_MS - now;
}

export function storyTimeLeft(ms: number): string {
  const minutes = Math.ceil(ms / 60_000);
  if (minutes < 60) return `${minutes}m left`;
  return `${Math.floor(minutes / 60)}h ${minutes % 60}m left`;
}

export function isStory(item: Pick<InstagramMedia, "media_product_type">): boolean {
  return (item.media_product_type || "").toUpperCase() === "STORY";
}

export function isVideo(item: Pick<InstagramMedia, "media_type">): boolean {
  return (item.media_type || "").toUpperCase() === "VIDEO";
}

/** The slides to show: a carousel's children, or the item itself. */
export function slidesOf(item: InstagramMedia): Array<InstagramMedia | InstagramMediaChild> {
  return item.children && item.children.length > 0 ? item.children : [item];
}

export function compactNumber(value: number | null | undefined): string {
  if (value === null || value === undefined) return "–";
  return new Intl.NumberFormat(undefined, { notation: "compact", maximumFractionDigits: 1 }).format(value);
}

export function shortDate(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short", year: "numeric" });
}

export function relativeTime(value?: string | null): string {
  if (!value) return "";
  const date = new Date(value.endsWith("Z") || value.includes("+") ? value : `${value}Z`);
  const seconds = Math.round((Date.now() - date.getTime()) / 1000);
  if (Number.isNaN(seconds)) return "";
  if (seconds < 60) return "just now";
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.round(hours / 24);
  if (days < 7) return `${days}d ago`;
  return shortDate(date.toISOString());
}
