"use client";

import { useEffect, useRef, useState } from "react";
import {
  instagramAutomationsApi,
  ApiError,
  type InstagramAutomation,
  type InstagramConnection,
  type InstagramLibraryItem,
  type InstagramPost,
  type InstagramPostInput,
  type InstagramPostType,
  type InstagramPublishOverview,
  type InstagramSnippet,
} from "@/lib/api";
import { Button, Card, Input, Select, Switch, Tabs, Textarea } from "@/components/ui";
import { AiModal, LibraryModal, SavedModal, ScheduleModal } from "./ComposerModals";
import { PostPreview } from "./PostPreview";
import {
  MAX_CAPTION,
  MAX_CAROUSEL_ITEMS,
  MAX_HASHTAGS,
  RATIO_OPTIONS,
  countHashtags,
  prepareImage,
  readImageRatio,
  resolveRatio,
  splitUsernames,
  type Ratio,
} from "./helpers";
import styles from "../InstagramPublishPanel.module.scss";

interface MediaDraft {
  key: string;
  previewUrl: string;
  isVideo: boolean;
  /** Present until uploaded; lets the crop be re-applied if the shape changes. */
  file?: File;
  hostedUrl?: string;
  altText: string;
  naturalRatio?: number;
}

interface CoverDraft {
  previewUrl: string;
  file?: File;
  hostedUrl?: string;
}

type Action = InstagramPostInput["action"];
type ModalName = "schedule" | "ai" | "saved" | "library" | null;

interface PublishComposerProps {
  businessId: string;
  connection: InstagramConnection;
  overview: InstagramPublishOverview | null;
  /** A draft, scheduled or failed post loaded back in for editing. */
  editing: InstagramPost | null;
  onSaved: (post: InstagramPost, action: "draft" | "schedule") => void;
  onPostsChanged: () => void;
  onReset: () => void;
}

const ACCEPTED_TYPES = ["image/jpeg", "image/png", "video/mp4", "video/quicktime"];
const POLL_INTERVAL_MS = 3000;
const POLL_TIMEOUT_MS = 8 * 60 * 1000;
const EMOJIS = [
  "😀", "😍", "🥳", "😎", "🤩", "😂", "🙌", "👏", "🙏", "💪",
  "🔥", "✨", "💯", "❤️", "💙", "💚", "⭐", "🎉", "🎁", "🚀",
  "📣", "📍", "🛒", "💡", "✅", "👉", "👇", "🏠", "📸", "🌟",
];
const TYPE_HINT: Record<InstagramPostType, string> = {
  feed: "One image, or up to 10 images and videos as a carousel.",
  reel: "One vertical video, shown in Reels.",
  story: "One image or video, visible for 24 hours.",
};

let draftCounter = 0;
const nextKey = () => `media-${Date.now()}-${draftCounter++}`;

export function PublishComposer({ businessId, connection, overview, editing, onSaved, onPostsChanged, onReset }: PublishComposerProps) {
  const [postType, setPostType] = useState<InstagramPostType>(editing?.post_type ?? "feed");
  const [items, setItems] = useState<MediaDraft[]>(() =>
    (editing?.media ?? []).map((media, index) => ({
      key: `saved-${index}`,
      previewUrl: media.url,
      hostedUrl: media.url,
      isVideo: media.is_video,
      altText: media.alt_text ?? "",
    }))
  );
  const [activeIndex, setActiveIndex] = useState(0);
  const [ratio, setRatio] = useState<Ratio>("original");
  const [caption, setCaption] = useState(editing?.caption ?? "");
  const [shareToFeed, setShareToFeed] = useState(editing?.share_to_feed ?? true);
  const [cover, setCover] = useState<CoverDraft | null>(
    editing?.cover_url ? { previewUrl: editing.cover_url, hostedUrl: editing.cover_url } : null
  );
  const [userTags, setUserTags] = useState((editing?.user_tags ?? []).join(", "));
  const [collaborators, setCollaborators] = useState((editing?.collaborators ?? []).join(", "));
  const [firstComment, setFirstComment] = useState(editing?.first_comment ?? "");
  const [commentsDisabled, setCommentsDisabled] = useState(editing?.comments_disabled ?? false);
  const [automationId, setAutomationId] = useState(editing?.automation_id ?? "");
  const [telegram, setTelegram] = useState(editing?.cross_post_telegram ?? false);
  const [facebook, setFacebook] = useState(editing?.cross_post_facebook ?? false);

  const [postId, setPostId] = useState<string | null>(editing?.id ?? null);
  const [automations, setAutomations] = useState<InstagramAutomation[]>([]);
  const [showMore, setShowMore] = useState(false);
  const [showEmoji, setShowEmoji] = useState(false);
  const [modal, setModal] = useState<ModalName>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(editing?.status === "failed" ? editing.error ?? null : null);
  const [published, setPublished] = useState<InstagramPost | null>(null);

  const captionRef = useRef<HTMLTextAreaElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const coverInputRef = useRef<HTMLInputElement>(null);
  const dragIndex = useRef<number | null>(null);
  const blobUrls = useRef<Set<string>>(new Set());
  const alive = useRef(true);

  useEffect(() => {
    alive.current = true;
    const urls = blobUrls.current;
    return () => {
      alive.current = false;
      urls.forEach((url) => URL.revokeObjectURL(url));
    };
  }, []);

  // Only automations scoped to specific posts need the new post added to them.
  useEffect(() => {
    let cancelled = false;
    instagramAutomationsApi
      .list(businessId, connection.id)
      .then((list) => {
        if (!cancelled) setAutomations(list.filter((item) => item.trigger.type === "comment" && item.scope.type === "specific"));
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [businessId, connection.id]);

  // Media reopened from a saved post has no known shape until it loads.
  const firstItem = items[0];
  useEffect(() => {
    if (!firstItem || firstItem.isVideo || firstItem.naturalRatio) return;
    const probe = new window.Image();
    probe.onload = () => {
      if (!alive.current || !probe.naturalHeight) return;
      const measured = probe.naturalWidth / probe.naturalHeight;
      setItems((prev) => prev.map((item) => (item.key === firstItem.key ? { ...item, naturalRatio: measured } : item)));
    };
    probe.src = firstItem.previewUrl;
  }, [firstItem]);

  const isStory = postType === "story";
  const isBusy = busy !== null;
  const activeItem = items[Math.min(activeIndex, items.length - 1)];
  const capacity = postType === "feed" ? MAX_CAROUSEL_ITEMS : 1;
  const canCrop = postType !== "reel" && items.some((item) => item.file && !item.isVideo);
  const feedRatio = resolveRatio(ratio, firstItem?.naturalRatio ?? 1, "feed");
  const hashtagCount = countHashtags(caption);
  const limit = overview?.limit;
  const limitReached = Boolean(limit && limit.used !== null && limit.total !== null && limit.used >= limit.total);
  const hasMoreOptions = !isStory || Boolean(overview?.telegram_connected || overview?.facebook_connected);

  function blobUrl(file: File): string {
    const url = URL.createObjectURL(file);
    blobUrls.current.add(url);
    return url;
  }

  /** Cropping happens at upload time, so a shape change invalidates uploads made from local files. */
  function forgetUploads(list: MediaDraft[]): MediaDraft[] {
    return list.map((item) => (item.file ? { ...item, hostedUrl: undefined } : item));
  }

  async function addFiles(files: File[]) {
    setError(null);
    let accepted = files.filter((file) => ACCEPTED_TYPES.includes(file.type));
    if (accepted.length < files.length) setError("Only JPEG, PNG, MP4 and MOV files can be published.");
    if (postType === "reel") {
      const videos = accepted.filter((file) => file.type.startsWith("video/"));
      if (accepted.length > 0 && videos.length === 0) {
        setError("A Reel needs a video. Switch to Post or Story to share an image.");
        return;
      }
      accepted = videos;
    }
    if (accepted.length === 0) return;

    const drafts: MediaDraft[] = await Promise.all(
      accepted.map(async (file) => {
        const isVideo = file.type.startsWith("video/");
        return {
          key: nextKey(),
          previewUrl: blobUrl(file),
          isVideo,
          file,
          altText: "",
          naturalRatio: isVideo ? undefined : await readImageRatio(file),
        };
      })
    );
    const merged = postType === "feed" ? [...items, ...drafts].slice(0, capacity) : drafts.slice(0, 1);
    if (postType === "feed" && items.length + drafts.length > capacity) setError(`A carousel holds up to ${capacity} items.`);
    setItems(merged);
    setActiveIndex(postType === "feed" ? Math.min(items.length, merged.length - 1) : 0);
    // Instagram publishes every single video as a Reel.
    if (postType === "feed" && merged.length === 1 && merged[0].isVideo) setPostType("reel");
  }

  function addFromLibrary(picked: InstagramLibraryItem) {
    setModal(null);
    setError(null);
    if (postType === "reel" && !picked.is_video) {
      setError("A Reel needs a video. Switch to Post or Story to share an image.");
      return;
    }
    const draft: MediaDraft = { key: nextKey(), previewUrl: picked.url, hostedUrl: picked.url, isVideo: picked.is_video, altText: "" };
    const merged = postType === "feed" ? [...items, draft].slice(0, capacity) : [draft];
    setItems(merged);
    setActiveIndex(merged.length - 1);
    if (postType === "feed" && merged.length === 1 && draft.isVideo) setPostType("reel");
  }

  function removeItem(key: string) {
    setItems((prev) => prev.filter((item) => item.key !== key));
    setActiveIndex(0);
  }

  function moveItem(from: number, to: number) {
    if (from === to) return;
    setItems((prev) => {
      const next = [...prev];
      const [moved] = next.splice(from, 1);
      next.splice(to, 0, moved);
      // The carousel takes its shape from the first item.
      return forgetUploads(next);
    });
    setActiveIndex(to);
  }

  function changeType(next: InstagramPostType) {
    setError(null);
    setPostType(next);
    setRatio("original");
    setActiveIndex(0);
    setItems((prev) => {
      const kept = next === "reel" ? prev.filter((item) => item.isVideo).slice(0, 1) : next === "story" ? prev.slice(0, 1) : prev;
      return forgetUploads(kept);
    });
  }

  function changeRatio(next: Ratio) {
    setRatio(next);
    setItems(forgetUploads);
  }

  function insertAtCursor(text: string) {
    const field = captionRef.current;
    const start = field?.selectionStart ?? caption.length;
    const end = field?.selectionEnd ?? caption.length;
    setCaption((caption.slice(0, start) + text + caption.slice(end)).slice(0, MAX_CAPTION));
    requestAnimationFrame(() => {
      field?.focus();
      field?.setSelectionRange(start + text.length, start + text.length);
    });
  }

  function appendToCaption(text: string, separator: string) {
    setCaption((prev) => (prev.trim() ? `${prev.trimEnd()}${separator}${text}` : text).slice(0, MAX_CAPTION));
  }

  function insertSnippet(snippet: InstagramSnippet) {
    appendToCaption(snippet.text, "\n\n");
    setModal(null);
  }

  async function pollUntilPublished(id: string) {
    const deadline = Date.now() + POLL_TIMEOUT_MS;
    while (alive.current && Date.now() < deadline) {
      await new Promise((resolve) => window.setTimeout(resolve, POLL_INTERVAL_MS));
      if (!alive.current) return;
      const post = await instagramAutomationsApi.getPost(businessId, id);
      if (post.status === "published") {
        setPublished(post);
        onPostsChanged();
        return;
      }
      if (post.status === "failed") {
        onPostsChanged();
        throw new Error(post.error || "Instagram couldn't publish this post.");
      }
    }
    if (alive.current) throw new Error("This is taking longer than expected. Check the Posted tab in a few minutes.");
  }

  async function submit(action: Action, scheduledAt: string | null = null) {
    setError(null);
    setModal(null);
    if (action !== "draft") {
      if (items.length === 0) return setError("Add an image or video first.");
      if (postType === "reel" && !items[0].isVideo) return setError("A Reel needs a video.");
      if (hashtagCount > MAX_HASHTAGS) return setError(`Instagram allows up to ${MAX_HASHTAGS} hashtags. Remove ${hashtagCount - MAX_HASHTAGS}.`);
    }

    try {
      // Upload anything still local. Images are cropped to the chosen shape first.
      const firstImage = items.find((item) => !item.isVideo);
      const uploaded: Record<string, string> = {};
      for (const [index, item] of items.entries()) {
        if (item.hostedUrl || !item.file) continue;
        setBusy(`Uploading ${index + 1} of ${items.length}…`);
        let file = item.file;
        if (!item.isVideo) {
          const shapeSource = postType === "feed" ? firstImage ?? item : item;
          file = await prepareImage(file, resolveRatio(ratio, shapeSource.naturalRatio ?? 1, postType));
        }
        const result = await instagramAutomationsApi.uploadMedia(businessId, file, { fit: isStory ? "free" : "feed" });
        uploaded[item.key] = result.url;
      }
      const hosted = items.map((item) => ({ ...item, hostedUrl: item.hostedUrl ?? uploaded[item.key] }));
      setItems(hosted);

      let coverUrl = postType === "reel" ? cover?.hostedUrl ?? null : null;
      if (postType === "reel" && cover?.file && !cover.hostedUrl) {
        setBusy("Uploading cover…");
        coverUrl = (await instagramAutomationsApi.uploadMedia(businessId, cover.file, { fit: "free", save: false })).url;
        setCover({ ...cover, hostedUrl: coverUrl });
      }

      const input: InstagramPostInput = {
        connection_id: connection.id,
        post_type: postType,
        media: hosted.map((item) => ({ url: item.hostedUrl ?? "", is_video: item.isVideo, alt_text: item.isVideo ? "" : item.altText.trim() })),
        caption: isStory ? "" : caption.trim(),
        share_to_feed: shareToFeed,
        cover_url: coverUrl,
        user_tags: isStory ? [] : splitUsernames(userTags),
        collaborators: isStory ? [] : splitUsernames(collaborators).slice(0, 3),
        first_comment: isStory || commentsDisabled ? "" : firstComment.trim(),
        comments_disabled: !isStory && commentsDisabled,
        automation_id: isStory ? null : automationId || null,
        cross_post_telegram: telegram,
        cross_post_facebook: facebook,
        scheduled_at: scheduledAt,
        action,
      };

      setBusy(action === "publish" ? "Publishing to Instagram…" : "Saving…");
      const post = postId
        ? await instagramAutomationsApi.updatePost(businessId, postId, input)
        : await instagramAutomationsApi.createPost(businessId, input);
      setPostId(post.id);
      if (action === "publish") await pollUntilPublished(post.id);
      else onSaved(post, action);
    } catch (err) {
      if (alive.current) setError(err instanceof ApiError ? err.userMessage : err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      if (alive.current) setBusy(null);
    }
  }

  if (published) {
    return (
      <Card>
        <div className={styles.publishedState}>
          <div className={styles.publishedIcon} aria-hidden="true">✓</div>
          <h3>Published</h3>
          <p className={styles.hint}>Your {postType === "feed" ? "post" : postType === "reel" ? "Reel" : "Story"} is now live on @{connection.instagram_username}.</p>
          {(published.warnings ?? []).map((warning) => (
            <p key={warning} className={styles.warningText}>{warning}</p>
          ))}
          <div className={styles.publishedActions}>
            {published.permalink && (
              <Button variant="secondary" onClick={() => window.open(published.permalink ?? "", "_blank", "noopener,noreferrer")}>View on Instagram</Button>
            )}
            <Button variant="primary" onClick={onReset}>Create another</Button>
          </div>
        </div>
      </Card>
    );
  }

  return (
    <div className={styles.composerLayout}>
      <Card className={styles.composerCard}>
        {editing && (
          <div className={styles.editingBar}>
            <span>Editing a {editing.status === "failed" ? "failed" : editing.status} post</span>
            <button type="button" className={styles.linkButton} onClick={onReset}>Start a new post instead</button>
          </div>
        )}

        <div className={styles.section}>
          <Tabs<InstagramPostType>
            options={[{ value: "feed", label: "Post" }, { value: "reel", label: "Reel" }, { value: "story", label: "Story" }]}
            value={postType}
            onChange={changeType}
          />
          <p className={styles.hint}>{TYPE_HINT[postType]}</p>
        </div>

        <div className={styles.section}>
          <input
            ref={fileInputRef}
            type="file"
            multiple={postType === "feed"}
            accept={postType === "reel" ? "video/mp4,video/quicktime" : ACCEPTED_TYPES.join(",")}
            className={styles.hiddenInput}
            onChange={(e) => {
              void addFiles(Array.from(e.target.files ?? []));
              e.target.value = "";
            }}
          />
          {items.length === 0 ? (
            <div
              className={styles.dropZone}
              role="button"
              tabIndex={0}
              onClick={() => fileInputRef.current?.click()}
              onKeyDown={(e) => {
                if (e.key === "Enter" || e.key === " ") fileInputRef.current?.click();
              }}
              onDragOver={(e) => e.preventDefault()}
              onDrop={(e) => {
                e.preventDefault();
                void addFiles(Array.from(e.dataTransfer.files ?? []));
              }}
            >
              <div className={styles.dropZoneIcon} aria-hidden="true">＋</div>
              <p>Drag {postType === "reel" ? "a video" : "photos or videos"} here, or click to choose</p>
              <span className={styles.hint}>{postType === "reel" ? "MP4 or MOV" : "JPEG, PNG, MP4 or MOV"} · up to 100MB</span>
            </div>
          ) : (
            <div className={styles.thumbStrip}>
              {items.map((item, index) => (
                <div
                  key={item.key}
                  className={styles.thumb}
                  data-active={index === activeIndex || undefined}
                  draggable={items.length > 1 && !isBusy}
                  onDragStart={() => {
                    dragIndex.current = index;
                  }}
                  onDragOver={(e) => e.preventDefault()}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragIndex.current !== null) moveItem(dragIndex.current, index);
                    dragIndex.current = null;
                  }}
                  onClick={() => setActiveIndex(index)}
                >
                  {item.isVideo ? (
                    <video src={item.previewUrl} muted preload="metadata" />
                  ) : (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img src={item.previewUrl} alt="" />
                  )}
                  {items.length > 1 && <span className={styles.thumbIndex}>{index + 1}</span>}
                  {!isBusy && (
                    <button
                      type="button"
                      className={styles.thumbRemove}
                      aria-label="Remove"
                      onClick={(e) => {
                        e.stopPropagation();
                        removeItem(item.key);
                      }}
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
              {items.length < capacity && !isBusy && (
                <button type="button" className={styles.thumbAdd} onClick={() => fileInputRef.current?.click()} aria-label="Add more">＋</button>
              )}
            </div>
          )}

          <div className={styles.mediaTools}>
            {canCrop && (
              <div className={styles.chipRow}>
                {RATIO_OPTIONS[postType].map((option) => (
                  <button key={option.value} type="button" className={styles.chip} data-active={ratio === option.value || undefined} onClick={() => changeRatio(option.value)} disabled={isBusy}>
                    {option.label}
                  </button>
                ))}
              </div>
            )}
            <button type="button" className={styles.linkButton} onClick={() => setModal("library")} disabled={isBusy}>Choose from library</button>
          </div>
          {items.length > 1 && <p className={styles.hint}>Drag to reorder. Every slide takes the shape of the first one.</p>}
        </div>

        {isStory ? (
          <p className={styles.hint}>Stories don&apos;t have captions.</p>
        ) : (
          <div className={styles.section}>
            <Textarea
              ref={captionRef}
              label="Caption"
              placeholder="Write a caption…"
              value={caption}
              onChange={(e) => setCaption(e.target.value)}
              maxLength={MAX_CAPTION}
              showCharCount
              rows={5}
              disabled={isBusy}
            />
            <div className={styles.captionBar}>
              <button type="button" className={styles.toolButton} onClick={() => setModal("ai")} disabled={isBusy}>✨ Write with AI</button>
              <button type="button" className={styles.toolButton} onClick={() => setModal("saved")} disabled={isBusy}># Saved</button>
              <button type="button" className={styles.toolButton} onClick={() => setShowEmoji((open) => !open)} disabled={isBusy} aria-expanded={showEmoji}>😊 Emoji</button>
              <span className={styles.hashtagCount} data-over={hashtagCount > MAX_HASHTAGS || undefined}>{hashtagCount}/{MAX_HASHTAGS} hashtags</span>
            </div>
            {showEmoji && (
              <div className={styles.emojiGrid}>
                {EMOJIS.map((emoji) => (
                  <button key={emoji} type="button" onClick={() => insertAtCursor(emoji)}>{emoji}</button>
                ))}
              </div>
            )}
          </div>
        )}

        {hasMoreOptions && (
          <div className={styles.section}>
            <button type="button" className={styles.moreToggle} onClick={() => setShowMore((open) => !open)} aria-expanded={showMore}>
              <span>More options</span>
              <span aria-hidden="true">{showMore ? "−" : "+"}</span>
            </button>
            {showMore && (
              <div className={styles.moreBody}>
                {postType === "feed" && activeItem && !activeItem.isVideo && (
                  <Input
                    label={items.length > 1 ? `Alt text for image ${activeIndex + 1}` : "Alt text"}
                    placeholder="Describe the image for people who can't see it"
                    value={activeItem.altText}
                    maxLength={1000}
                    onChange={(e) => setItems((prev) => prev.map((item) => (item.key === activeItem.key ? { ...item, altText: e.target.value } : item)))}
                  />
                )}
                {postType === "reel" && (
                  <>
                    <Switch checked={shareToFeed} onChange={setShareToFeed} label="Also show in the main feed" />
                    <div className={styles.coverRow}>
                      <input
                        ref={coverInputRef}
                        type="file"
                        accept="image/jpeg,image/png"
                        className={styles.hiddenInput}
                        onChange={(e) => {
                          const file = e.target.files?.[0];
                          if (file) setCover({ file, previewUrl: blobUrl(file) });
                          e.target.value = "";
                        }}
                      />
                      {cover && (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img src={cover.previewUrl} alt="Reel cover" className={styles.coverThumb} />
                      )}
                      <Button size="sm" variant="secondary" onClick={() => coverInputRef.current?.click()}>{cover ? "Change cover" : "Choose a cover image"}</Button>
                      {cover && <Button size="sm" variant="ghost" onClick={() => setCover(null)}>Remove</Button>}
                    </div>
                  </>
                )}
                {!isStory && (
                  <>
                    <Input label="Tag accounts" placeholder="@username, @another" value={userTags} onChange={(e) => setUserTags(e.target.value)} />
                    <Input
                      label="Invite collaborators"
                      placeholder="@username"
                      value={collaborators}
                      onChange={(e) => setCollaborators(e.target.value)}
                      helperText="Up to 3. The post shows on their profile once they accept."
                    />
                    <Switch checked={commentsDisabled} onChange={setCommentsDisabled} label="Turn off comments" />
                    {!commentsDisabled && (
                      <Textarea
                        label="First comment"
                        placeholder="Posted right after publishing, a tidy place for hashtags"
                        value={firstComment}
                        onChange={(e) => setFirstComment(e.target.value)}
                        maxLength={MAX_CAPTION}
                        rows={2}
                      />
                    )}
                    {automations.length > 0 && (
                      <Select label="Run a comment automation on this post" value={automationId} onChange={(e) => setAutomationId(e.target.value)}>
                        <option value="">None</option>
                        {automations.map((automation) => (
                          <option key={automation.id} value={automation.id}>{automation.name}</option>
                        ))}
                      </Select>
                    )}
                  </>
                )}
                {overview?.telegram_connected && <Switch checked={telegram} onChange={setTelegram} label="Also send to Telegram" />}
                {overview?.facebook_connected && <Switch checked={facebook} onChange={setFacebook} label="Also post to your Facebook Page" />}
              </div>
            )}
          </div>
        )}

        {busy && (
          <div className={styles.busyBar} role="status">
            <span className={styles.spinner} aria-hidden="true" />
            <span>{busy}</span>
          </div>
        )}
        {error && <p className={styles.errorText} role="alert">{error}</p>}

        <div className={styles.actions}>
          <Button variant="primary" onClick={() => submit("publish")} disabled={isBusy || items.length === 0 || limitReached}>Publish now</Button>
          <Button variant="secondary" onClick={() => setModal("schedule")} disabled={isBusy || items.length === 0}>
            {editing?.status === "scheduled" ? "Reschedule" : "Schedule"}
          </Button>
          <Button variant="ghost" onClick={() => submit("draft")} disabled={isBusy || (items.length === 0 && !caption.trim())}>Save draft</Button>
        </div>
        {limit && limit.used !== null && limit.total !== null && (
          <p className={styles.hint} data-warning={limitReached || undefined}>
            {limitReached ? "Daily Instagram limit reached. You can still schedule or save a draft. " : ""}
            {limit.used} of {limit.total} posts used in the last 24 hours.
          </p>
        )}
      </Card>

      <aside className={styles.previewColumn}>
        <div className={styles.previewLabel}>Preview</div>
        <PostPreview
          postType={postType}
          username={connection.instagram_username}
          caption={caption}
          media={items}
          activeIndex={Math.min(activeIndex, Math.max(items.length - 1, 0))}
          onActiveIndexChange={setActiveIndex}
          ratio={feedRatio}
          fillFrame={postType === "reel" || ratio === "9:16"}
        />
      </aside>

      {modal === "schedule" && (
        <ScheduleModal
          businessId={businessId}
          connectionId={connection.id}
          initial={editing?.scheduled_at}
          onClose={() => setModal(null)}
          onConfirm={(iso) => submit("schedule", iso)}
        />
      )}
      {modal === "ai" && (
        <AiModal
          businessId={businessId}
          caption={caption}
          onClose={() => setModal(null)}
          onUseCaption={(text) => {
            setCaption(text.slice(0, MAX_CAPTION));
            setModal(null);
          }}
          onAddHashtags={(tags) => appendToCaption(tags, caption.includes("#") ? " " : "\n\n")}
        />
      )}
      {modal === "saved" && <SavedModal businessId={businessId} caption={caption} onClose={() => setModal(null)} onInsert={insertSnippet} />}
      {modal === "library" && <LibraryModal businessId={businessId} onClose={() => setModal(null)} onPick={addFromLibrary} />}
    </div>
  );
}
