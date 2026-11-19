import type { InstagramPostType } from "@/lib/api";

export type Ratio = "original" | "1:1" | "4:5" | "1.91:1" | "9:16";

export const MAX_CAPTION = 2200;
export const MAX_HASHTAGS = 30;
export const MAX_CAROUSEL_ITEMS = 10;

const RATIO_VALUE: Record<Exclude<Ratio, "original">, number> = {
  "1:1": 1,
  "4:5": 0.8,
  "1.91:1": 1.91,
  "9:16": 9 / 16,
};
// Instagram rejects feed images outside this range.
const FEED_MIN_RATIO = 0.8;
const FEED_MAX_RATIO = 1.91;
const MAX_IMAGE_WIDTH = 1440;

export const RATIO_OPTIONS: Record<InstagramPostType, Array<{ value: Ratio; label: string }>> = {
  feed: [
    { value: "original", label: "Original" },
    { value: "1:1", label: "Square" },
    { value: "4:5", label: "Portrait" },
    { value: "1.91:1", label: "Landscape" },
  ],
  story: [
    { value: "original", label: "Original" },
    { value: "9:16", label: "Full screen" },
  ],
  reel: [],
};

/** The width/height the image will actually be published at. */
export function resolveRatio(ratio: Ratio, natural: number, postType: InstagramPostType): number {
  if (ratio !== "original") return RATIO_VALUE[ratio];
  if (postType === "story") return natural;
  return Math.min(FEED_MAX_RATIO, Math.max(FEED_MIN_RATIO, natural));
}

export async function readImageRatio(file: File): Promise<number> {
  try {
    const bitmap = await createImageBitmap(file);
    const ratio = bitmap.width / bitmap.height;
    bitmap.close();
    return ratio || 1;
  } catch {
    return 1;
  }
}

/** Centre-crop an image to `target` (width/height) and re-encode it as JPEG,
 *  the only image format Instagram's publishing API accepts. */
export async function prepareImage(file: File, target: number): Promise<File> {
  const bitmap = await createImageBitmap(file);
  const natural = bitmap.width / bitmap.height;
  let cropWidth = bitmap.width;
  let cropHeight = bitmap.height;
  if (Math.abs(natural - target) > 0.01) {
    if (natural > target) cropWidth = Math.round(cropHeight * target);
    else cropHeight = Math.round(cropWidth / target);
  } else if (file.type === "image/jpeg" && bitmap.width <= MAX_IMAGE_WIDTH) {
    bitmap.close();
    return file;
  }

  const scale = Math.min(1, MAX_IMAGE_WIDTH / cropWidth);
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(cropWidth * scale);
  canvas.height = Math.round(cropHeight * scale);
  const context = canvas.getContext("2d");
  if (!context) {
    bitmap.close();
    return file;
  }
  // JPEG has no transparency, so give transparent PNGs a white background.
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, canvas.width, canvas.height);
  context.drawImage(
    bitmap,
    (bitmap.width - cropWidth) / 2,
    (bitmap.height - cropHeight) / 2,
    cropWidth,
    cropHeight,
    0,
    0,
    canvas.width,
    canvas.height
  );
  bitmap.close();

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.92));
  if (!blob) return file;
  return new File([blob], `${file.name.replace(/\.\w+$/, "")}.jpg`, { type: "image/jpeg" });
}

export function countHashtags(text: string): number {
  return (text.match(/#[^\s#]+/g) ?? []).length;
}

export function extractHashtags(text: string): string {
  return (text.match(/#[^\s#]+/g) ?? []).join(" ");
}

export function splitUsernames(text: string): string[] {
  return text
    .split(/[\s,]+/)
    .map((name) => name.replace(/^@/, "").trim())
    .filter(Boolean);
}

export function formatDateTime(iso?: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

/** Value for an <input type="datetime-local">, in the viewer's own timezone. */
export function toLocalInputValue(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export const POST_TYPE_LABEL: Record<InstagramPostType, string> = {
  feed: "Post",
  reel: "Reel",
  story: "Story",
};
