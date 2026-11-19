"use client";

import { useEffect, useState } from "react";
import {
  instagramAutomationsApi,
  ApiError,
  type InstagramBestTimes,
  type InstagramLibraryItem,
  type InstagramSnippet,
} from "@/lib/api";
import { Button, Input, Modal, Select, Skeleton, Textarea } from "@/components/ui";
import { extractHashtags, toLocalInputValue } from "./helpers";
import styles from "../InstagramPublishPanel.module.scss";

function errorText(err: unknown, fallback: string): string {
  return err instanceof ApiError ? err.userMessage : fallback;
}

// ── Schedule ──

interface ScheduleModalProps {
  businessId: string;
  connectionId: string;
  initial?: string | null;
  onClose: () => void;
  onConfirm: (iso: string) => void;
}

/** Next local occurrence of a UTC hour, at least a few minutes away. */
function nextOccurrence(hourUtc: number): Date {
  const date = new Date();
  date.setUTCHours(hourUtc, 0, 0, 0);
  if (date.getTime() < Date.now() + 5 * 60 * 1000) date.setUTCDate(date.getUTCDate() + 1);
  return date;
}

export function ScheduleModal({ businessId, connectionId, initial, onClose, onConfirm }: ScheduleModalProps) {
  const [value, setValue] = useState(() => {
    if (initial && new Date(initial).getTime() > Date.now()) return toLocalInputValue(new Date(initial));
    const nextHour = new Date(Date.now() + 60 * 60 * 1000);
    nextHour.setMinutes(0, 0, 0);
    return toLocalInputValue(nextHour);
  });
  const [bestTimes, setBestTimes] = useState<InstagramBestTimes | null>(null);

  useEffect(() => {
    let cancelled = false;
    instagramAutomationsApi
      .bestTimes(businessId, connectionId)
      .then((result) => {
        if (!cancelled) setBestTimes(result);
      })
      .catch(() => {
        if (!cancelled) setBestTimes({ hours: [], sample_size: 0 });
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, connectionId]);

  // The moment the dialog opened is close enough: the server re-checks on save.
  const [openedAt] = useState(() => Date.now());
  const chosen = value ? new Date(value) : null;
  const isFuture = Boolean(chosen && chosen.getTime() > openedAt);
  const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;

  return (
    <Modal
      isOpen
      onClose={onClose}
      title="Schedule post"
      footer={
        <>
          <Button variant="secondary" onClick={onClose}>Cancel</Button>
          <Button variant="primary" disabled={!isFuture} onClick={() => chosen && onConfirm(chosen.toISOString())}>Schedule</Button>
        </>
      }
    >
      <div className={styles.modalStack}>
        <Input
          type="datetime-local"
          label="Date and time"
          value={value}
          min={toLocalInputValue(new Date(openedAt))}
          onChange={(e) => setValue(e.target.value)}
          helperText={`Your timezone: ${timezone}`}
          errorText={value && !isFuture ? "Pick a time in the future." : undefined}
        />
        <div>
          <div className={styles.modalLabel}>Suggested times</div>
          {!bestTimes ? (
            <Skeleton height={32} />
          ) : bestTimes.hours.length === 0 ? (
            <p className={styles.hint}>Suggestions appear once this account has at least 5 posts to learn from.</p>
          ) : (
            <>
              <div className={styles.chipRow}>
                {bestTimes.hours.map((slot) => {
                  const when = nextOccurrence(slot.hour_utc);
                  const day = when.toDateString() === new Date().toDateString() ? "Today" : "Tomorrow";
                  const time = when.toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
                  return (
                    <button
                      key={slot.hour_utc}
                      type="button"
                      className={styles.chip}
                      data-active={value === toLocalInputValue(when) || undefined}
                      onClick={() => setValue(toLocalInputValue(when))}
                    >
                      {day} {time}
                    </button>
                  );
                })}
              </div>
              <p className={styles.hint}>Hours when your last {bestTimes.sample_size} posts got the most likes and comments.</p>
            </>
          )}
        </div>
      </div>
    </Modal>
  );
}

// ── AI writer ──

interface AiModalProps {
  businessId: string;
  caption: string;
  onClose: () => void;
  onUseCaption: (caption: string) => void;
  onAddHashtags: (hashtags: string) => void;
}

const TONES = ["friendly", "professional", "playful", "bold", "inspirational"];

export function AiModal({ businessId, caption, onClose, onUseCaption, onAddHashtags }: AiModalProps) {
  const [brief, setBrief] = useState("");
  const [tone, setTone] = useState(TONES[0]);
  const [captions, setCaptions] = useState<string[]>([]);
  const [hashtags, setHashtags] = useState<string[]>([]);
  const [loading, setLoading] = useState<"captions" | "hashtags" | null>(null);
  const [error, setError] = useState<string | null>(null);

  async function writeCaptions() {
    setLoading("captions");
    setError(null);
    try {
      setCaptions(await instagramAutomationsApi.aiCaptions(businessId, brief.trim(), tone));
    } catch (err) {
      setError(errorText(err, "Couldn't write captions. Please try again."));
    } finally {
      setLoading(null);
    }
  }

  async function suggestHashtags() {
    setLoading("hashtags");
    setError(null);
    try {
      setHashtags(await instagramAutomationsApi.aiHashtags(businessId, (caption || brief).trim()));
    } catch (err) {
      setError(errorText(err, "Couldn't suggest hashtags. Please try again."));
    } finally {
      setLoading(null);
    }
  }

  const hashtagSource = (caption || brief).trim();

  return (
    <Modal isOpen onClose={onClose} title="Write with AI" size="lg">
      <div className={styles.modalStack}>
        <Textarea
          label="What is this post about?"
          placeholder="e.g. Launching our new smart door lock, 20% off this week"
          value={brief}
          onChange={(e) => setBrief(e.target.value)}
          rows={3}
          maxLength={1000}
        />
        <div className={styles.modalRow}>
          <Select label="Tone" value={tone} onChange={(e) => setTone(e.target.value)}>
            {TONES.map((item) => (
              <option key={item} value={item}>{item.charAt(0).toUpperCase() + item.slice(1)}</option>
            ))}
          </Select>
          <Button variant="primary" onClick={writeCaptions} isLoading={loading === "captions"} disabled={!brief.trim() || loading !== null}>
            Write captions
          </Button>
          <Button variant="secondary" onClick={suggestHashtags} isLoading={loading === "hashtags"} disabled={!hashtagSource || loading !== null}>
            Suggest hashtags
          </Button>
        </div>
        {error && <p className={styles.errorText}>{error}</p>}

        {captions.map((option, index) => (
          <div key={index} className={styles.optionCard}>
            <p>{option}</p>
            <Button size="sm" variant="secondary" onClick={() => onUseCaption(option)}>Use this caption</Button>
          </div>
        ))}

        {hashtags.length > 0 && (
          <div>
            <div className={styles.modalLabel}>Tap a hashtag to add it</div>
            <div className={styles.chipRow}>
              {hashtags.map((tag) => (
                <button key={tag} type="button" className={styles.chip} onClick={() => { onAddHashtags(tag); setHashtags((prev) => prev.filter((item) => item !== tag)); }}>
                  {tag}
                </button>
              ))}
              <button type="button" className={styles.chip} data-active onClick={() => { onAddHashtags(hashtags.join(" ")); setHashtags([]); }}>
                Add all
              </button>
            </div>
          </div>
        )}
      </div>
    </Modal>
  );
}

// ── Saved captions and hashtag sets ──

interface SavedModalProps {
  businessId: string;
  caption: string;
  onClose: () => void;
  onInsert: (snippet: InstagramSnippet) => void;
}

export function SavedModal({ businessId, caption, onClose, onInsert }: SavedModalProps) {
  const [snippets, setSnippets] = useState<InstagramSnippet[] | null>(null);
  const [name, setName] = useState("");
  const [error, setError] = useState<string | null>(null);
  const hashtagsInCaption = extractHashtags(caption);

  useEffect(() => {
    let cancelled = false;
    instagramAutomationsApi
      .snippets(businessId)
      .then((list) => {
        if (!cancelled) setSnippets(list);
      })
      .catch(() => {
        if (!cancelled) setSnippets([]);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  async function save(kind: InstagramSnippet["kind"], text: string) {
    setError(null);
    try {
      const created = await instagramAutomationsApi.createSnippet(businessId, { kind, name: name.trim(), text });
      setSnippets((prev) => [created, ...(prev ?? [])]);
      setName("");
    } catch (err) {
      setError(errorText(err, "Couldn't save. Please try again."));
    }
  }

  async function remove(id: string) {
    setSnippets((prev) => (prev ?? []).filter((item) => item.id !== id));
    await instagramAutomationsApi.deleteSnippet(businessId, id).catch(() => undefined);
  }

  return (
    <Modal isOpen onClose={onClose} title="Saved captions and hashtags" size="lg">
      <div className={styles.modalStack}>
        {!snippets ? (
          <Skeleton height={80} />
        ) : snippets.length === 0 ? (
          <p className={styles.hint}>Nothing saved yet. Save the caption or hashtags you are writing to reuse them later.</p>
        ) : (
          snippets.map((snippet) => (
            <div key={snippet.id} className={styles.optionCard}>
              <div className={styles.optionHead}>
                <strong>{snippet.name}</strong>
                <span className={styles.hint}>{snippet.kind === "hashtags" ? "Hashtag set" : "Caption"}</span>
              </div>
              <p>{snippet.text}</p>
              <div className={styles.modalRow}>
                <Button size="sm" variant="secondary" onClick={() => onInsert(snippet)}>Insert</Button>
                <Button size="sm" variant="ghost" onClick={() => remove(snippet.id)}>Delete</Button>
              </div>
            </div>
          ))
        )}

        <div className={styles.saveBox}>
          <Input label="Save what you are writing" placeholder="Give it a name" value={name} onChange={(e) => setName(e.target.value)} maxLength={60} />
          <div className={styles.modalRow}>
            <Button size="sm" variant="secondary" disabled={!name.trim() || !caption.trim()} onClick={() => save("caption", caption.trim())}>
              Save caption
            </Button>
            <Button size="sm" variant="secondary" disabled={!name.trim() || !hashtagsInCaption} onClick={() => save("hashtags", hashtagsInCaption)}>
              Save its hashtags
            </Button>
          </div>
          {error && <p className={styles.errorText}>{error}</p>}
        </div>
      </div>
    </Modal>
  );
}

// ── Media library ──

interface LibraryModalProps {
  businessId: string;
  onClose: () => void;
  onPick: (item: InstagramLibraryItem) => void;
}

export function LibraryModal({ businessId, onClose, onPick }: LibraryModalProps) {
  const [items, setItems] = useState<InstagramLibraryItem[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    instagramAutomationsApi
      .library(businessId)
      .then((list) => {
        if (!cancelled) setItems(list);
      })
      .catch(() => {
        if (!cancelled) setItems([]);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId]);

  async function remove(id: string) {
    setItems((prev) => (prev ?? []).filter((item) => item.id !== id));
    await instagramAutomationsApi.deleteLibraryItem(businessId, id).catch(() => undefined);
  }

  return (
    <Modal isOpen onClose={onClose} title="Media library" size="lg">
      {!items ? (
        <Skeleton height={160} />
      ) : items.length === 0 ? (
        <p className={styles.hint}>Everything you upload here is kept in your library so you can reuse it.</p>
      ) : (
        <div className={styles.libraryGrid}>
          {items.map((item) => (
            <div key={item.id} className={styles.libraryItem}>
              <button type="button" className={styles.libraryPick} onClick={() => onPick(item)} aria-label="Use this media">
                {item.is_video ? (
                  <video src={item.url} muted preload="metadata" />
                ) : (
                  // eslint-disable-next-line @next/next/no-img-element
                  <img src={item.url} alt="" loading="lazy" />
                )}
                {item.is_video && <span className={styles.videoTag}>Video</span>}
              </button>
              <button type="button" className={styles.removeButton} onClick={() => remove(item.id)} aria-label="Remove from library">✕</button>
            </div>
          ))}
        </div>
      )}
    </Modal>
  );
}
