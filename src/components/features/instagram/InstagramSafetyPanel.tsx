"use client";

import { useCallback, useEffect, useState } from "react";
import {
  instagramAutomationsApi,
  ApiError,
  type InstagramSafetyLimits,
  type InstagramSafetyNumberKey,
  type InstagramSafetyOverview,
} from "@/lib/api";
import { useToast } from "@/context/ToastContext";
import { Badge, Button, Card, Input, Modal, ProgressBar, Skeleton, Switch } from "@/components/ui";
import styles from "./InstagramSafetyPanel.module.scss";

interface Field {
  key: InstagramSafetyNumberKey;
  label: string;
  unit: string;
}

const FIELD_GROUPS: Array<{ title: string; hint: string; fields: Field[] }> = [
  {
    title: "Comment-to-DM replies",
    hint: "The private message sent when someone comments. Instagram's own limit is 750 an hour.",
    fields: [
      { key: "private_replies_per_hour", label: "Per hour", unit: "replies" },
      { key: "private_replies_per_day", label: "Per day", unit: "replies" },
    ],
  },
  {
    title: "Public comment replies",
    hint: "Replies posted under a comment, visible to everyone.",
    fields: [
      { key: "public_replies_per_hour", label: "Per hour", unit: "replies" },
      { key: "public_replies_per_day", label: "Per day", unit: "replies" },
    ],
  },
  {
    title: "Automated DMs",
    hint: "Follow-up messages sent by automations inside an open conversation.",
    fields: [
      { key: "dms_per_hour", label: "Per hour", unit: "messages" },
      { key: "dms_per_day", label: "Per day", unit: "messages" },
    ],
  },
  {
    title: "Pacing",
    hint: "A random pause between sends, so a busy post gets a steady trickle of replies instead of a burst.",
    fields: [
      { key: "min_gap_seconds", label: "Shortest gap", unit: "seconds" },
      { key: "max_gap_seconds", label: "Longest gap", unit: "seconds" },
    ],
  },
  {
    title: "Other",
    hint: "Posts published in 24 hours (Instagram's own limit is 100), and how long before the same person can trigger the same comment automation again.",
    fields: [
      { key: "posts_per_day", label: "Posts per day", unit: "posts" },
      { key: "person_cooldown_hours", label: "Same-person cooldown", unit: "hours" },
    ],
  },
];
const ALL_FIELDS = FIELD_GROUPS.flatMap((group) => group.fields);

function formatTime(iso: string | null): string {
  if (!iso) return "";
  return new Date(iso).toLocaleString(undefined, { month: "short", day: "numeric", hour: "numeric", minute: "2-digit" });
}

function statusOf(overview: InstagramSafetyOverview): { label: string; variant: "success" | "warning" | "danger" | "info"; message: string } {
  const { state, limits } = overview;
  if (state.paused_until) {
    return state.pause_reason === "meta_policy_block"
      ? {
          label: "Restricted by Instagram",
          variant: "danger",
          message: `Instagram temporarily blocked this account from sending. Automation is paused until ${formatTime(state.paused_until)} to protect it. Review your recent replies and lower the limits below before it resumes.`,
        }
      : {
          label: "Paused briefly",
          variant: "warning",
          message: `Instagram asked this account to slow down. Sending resumes ${formatTime(state.paused_until)}; queued replies go out after that.`,
        };
  }
  if (limits.sending_paused) {
    return {
      label: "Paused on purpose",
      variant: "warning",
      message: "Nothing is being sent. Comments that arrive are kept, not lost: when you resume you choose whether to reply to them. Your AI agent still answers people who message you directly.",
    };
  }
  if (state.slowed_until) {
    return { label: "Slowed down", variant: "info", message: "This account is close to Instagram's allowance, so replies are being spaced further apart for a few minutes." };
  }
  if (state.warmup_active) {
    return {
      label: "Warming up",
      variant: "info",
      message: `New connection: lower limits apply until ${formatTime(state.warmup_ends_at)} so activity builds up gradually.`,
    };
  }
  return { label: "Protected", variant: "success", message: "Sending stays inside your limits. Anything over the limit waits in a queue and is sent later, never dropped." };
}

export function InstagramSafetyPanel({ businessId, connectionId }: { businessId: string; connectionId: string }) {
  const { show } = useToast();
  const [overview, setOverview] = useState<InstagramSafetyOverview | null>(null);
  const [failed, setFailed] = useState(false);
  const [draft, setDraft] = useState<Record<string, string>>({});
  const [isOpen, setIsOpen] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [isResumeOpen, setIsResumeOpen] = useState(false);
  const [replyToWaiting, setReplyToWaiting] = useState(true);

  const apply = useCallback((next: InstagramSafetyOverview) => {
    setOverview(next);
    setDraft(Object.fromEntries(ALL_FIELDS.map((field) => [field.key, String(next.limits[field.key])])));
  }, []);

  useEffect(() => {
    let cancelled = false;
    instagramAutomationsApi
      .safety(businessId, connectionId)
      .then((result) => {
        if (!cancelled) apply(result);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
    };
  }, [businessId, connectionId, apply]);

  if (failed) return null;
  if (!overview) return <Skeleton height={120} />;

  const { effective, usage, hard_caps: hardCaps, floors, defaults, state } = overview;
  const status = statusOf(overview);

  function errorFor(field: Field): string | undefined {
    const raw = draft[field.key] ?? "";
    const value = Number(raw);
    if (raw.trim() === "" || !Number.isInteger(value)) return "Enter a whole number.";
    if (value > hardCaps[field.key]) return `Can't be more than ${hardCaps[field.key].toLocaleString()}.`;
    if (value < floors[field.key]) return `Can't be less than ${floors[field.key]}.`;
    if (field.key === "max_gap_seconds" && value < Number(draft.min_gap_seconds)) return "Must be at least the shortest gap.";
    return undefined;
  }

  const hasErrors = ALL_FIELDS.some((field) => errorFor(field));
  const isDirty = ALL_FIELDS.some((field) => draft[field.key] !== String(overview.limits[field.key]));

  async function save(changes: Partial<InstagramSafetyLimits>, message: string) {
    setIsSaving(true);
    try {
      apply(await instagramAutomationsApi.updateSafety(businessId, connectionId, changes));
      show(message, "success");
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't save the limits. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function pauseSending() {
    setIsSaving(true);
    try {
      apply(await instagramAutomationsApi.pauseSending(businessId, connectionId));
      show("Sending paused. Comments that arrive will be kept for you.", "success");
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't pause sending. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  async function resumeSending() {
    setIsSaving(true);
    try {
      const result = await instagramAutomationsApi.resumeSending(businessId, connectionId, replyToWaiting);
      apply(result);
      setIsResumeOpen(false);
      const { replying_to: replying, skipped } = result.resumed;
      show(
        replying > 0
          ? `Sending resumed. Replying to ${replying.toLocaleString()} waiting ${replying === 1 ? "comment" : "comments"}.`
          : skipped > 0
            ? `Sending resumed. Skipped ${skipped.toLocaleString()} waiting ${skipped === 1 ? "comment" : "comments"}.`
            : "Sending resumed.",
        "success"
      );
    } catch (err) {
      show(err instanceof ApiError ? err.userMessage : "Couldn't resume sending. Please try again.", "error");
    } finally {
      setIsSaving(false);
    }
  }

  function saveNumbers() {
    const changes = Object.fromEntries(ALL_FIELDS.map((field) => [field.key, Number(draft[field.key])]));
    void save(changes, "Safety limits saved.");
  }

  function resetToRecommended() {
    setDraft(Object.fromEntries(ALL_FIELDS.map((field) => [field.key, String(defaults[field.key])])));
  }

  const meters = [
    { label: "Comment-to-DM replies this hour", value: usage.private_reply.hour, max: effective.private_replies_per_hour },
    { label: "Public comment replies this hour", value: usage.public_reply.hour, max: effective.public_replies_per_hour },
    { label: "Automated DMs this hour", value: usage.dm.hour, max: effective.dms_per_hour },
    { label: "Posts in the last 24 hours", value: usage.posts.day, max: effective.posts_per_day },
  ];

  return (
    <Card className={styles.panel}>
      <div className={styles.head}>
        <div>
          <div className={styles.titleRow}>
            <h3 className={styles.title}>Account safety</h3>
            <Badge variant={status.variant}>{status.label}</Badge>
          </div>
          <p className={styles.message}>{status.message}</p>
          {state.queued > 0 && !overview.limits.sending_paused && (
            <p className={styles.message}>{state.queued.toLocaleString()} replies are waiting in the queue and will go out on their own.</p>
          )}
        </div>
        <div className={styles.headActions}>
          {overview.limits.sending_paused ? (
            <Button size="sm" onClick={() => setIsResumeOpen(true)} disabled={isSaving}>
              Resume sending…
            </Button>
          ) : (
            <Button size="sm" variant="secondary" onClick={pauseSending} disabled={isSaving}>
              Pause sending
            </Button>
          )}
          <Button size="sm" variant="secondary" onClick={() => setIsOpen((open) => !open)} aria-expanded={isOpen}>
            {isOpen ? "Hide limits" : "Adjust limits"}
          </Button>
        </div>
      </div>

      {overview.limits.sending_paused && (
        <div className={styles.pausedBox} role="status">
          <div className={styles.pausedTitle}>
            {state.queued_by_pause > 0
              ? `${state.queued_by_pause.toLocaleString()} ${state.queued_by_pause === 1 ? "comment is" : "comments are"} waiting for a reply`
              : "No comments are waiting right now"}
          </div>
          <div className={styles.pausedText}>
            {state.queued_by_pause > 0
              ? "They arrived while sending was paused. Resume to reply to them, or skip them."
              : "Anything that arrives while paused is kept here for you."}
          </div>
        </div>
      )}

      <div className={styles.meters}>
        {meters.map((meter) => (
          <ProgressBar key={meter.label} label={meter.label} value={meter.value} max={meter.max} />
        ))}
      </div>

      {isOpen && (
        <div className={styles.settings}>
          <p className={styles.note}>
            Lower numbers are safer. Each limit has a maximum you can&apos;t go past, and the starting values are the recommended safe range.
            {state.warmup_active ? " While the account is warming up, the lower warm-up limits shown in the bars above apply instead." : ""}
          </p>

          {FIELD_GROUPS.map((group) => (
            <div key={group.title} className={styles.group}>
              <div>
                <div className={styles.groupTitle}>{group.title}</div>
                <p className={styles.note}>{group.hint}</p>
              </div>
              <div className={styles.fields}>
                {group.fields.map((field) => (
                  <Input
                    key={field.key}
                    type="number"
                    inputMode="numeric"
                    label={field.label}
                    min={floors[field.key]}
                    max={hardCaps[field.key]}
                    value={draft[field.key] ?? ""}
                    onChange={(e) => setDraft((prev) => ({ ...prev, [field.key]: e.target.value }))}
                    errorText={errorFor(field)}
                    helperText={
                      overview.admin_limited.includes(field.key)
                        ? `Your plan allows up to ${hardCaps[field.key].toLocaleString()} ${field.unit}`
                        : `Recommended ${defaults[field.key].toLocaleString()} · maximum ${hardCaps[field.key].toLocaleString()} ${field.unit}`
                    }
                  />
                ))}
              </div>
            </div>
          ))}

          <div className={styles.actions}>
            <Button variant="primary" onClick={saveNumbers} isLoading={isSaving} disabled={hasErrors || !isDirty}>Save limits</Button>
            <Button variant="ghost" onClick={resetToRecommended} disabled={isSaving}>Reset to recommended</Button>
          </div>

          <div className={styles.toggles}>
            <div>
              <Switch
                checked={overview.limits.warmup_enabled}
                onChange={(checked) => save({ warmup_enabled: checked }, checked ? "Warm-up turned on." : "Warm-up turned off.")}
                label="Warm up new connections"
                disabled={isSaving}
              />
              <p className={styles.note}>Uses lower limits for the first 14 days after connecting. Recommended for new or small accounts.</p>
            </div>
          </div>

          <p className={styles.note}>
            Tip: write public replies with variations, like <code>{"{Sent!|Check your DMs|Just messaged you}"}</code>. One is picked at random each
            time, so replies aren&apos;t identical.
          </p>
        </div>
      )}

      <Modal
        isOpen={isResumeOpen}
        onClose={() => setIsResumeOpen(false)}
        title="Resume sending"
        footer={
          <>
            <Button variant="ghost" onClick={() => setIsResumeOpen(false)}>
              Cancel
            </Button>
            <Button onClick={resumeSending} isLoading={isSaving}>
              {state.queued_by_pause > 0 && replyToWaiting ? "Resume and reply" : "Resume"}
            </Button>
          </>
        }
      >
        {state.queued_by_pause > 0 ? (
          <>
            <p className={styles.dialogText}>
              <strong>
                {state.queued_by_pause.toLocaleString()} {state.queued_by_pause === 1 ? "comment" : "comments"}
              </strong>{" "}
              arrived while sending was paused and {state.queued_by_pause === 1 ? "hasn't" : "haven't"} been answered. What should happen to{" "}
              {state.queued_by_pause === 1 ? "it" : "them"}?
            </p>
            <fieldset className={styles.choices}>
              <label className={`${styles.choice} ${replyToWaiting ? styles.chosen : ""}`}>
                <input type="radio" name="waiting" checked={replyToWaiting} onChange={() => setReplyToWaiting(true)} />
                <span>
                  <span className={styles.choiceTitle}>Reply to them</span>
                  <span className={styles.choiceText}>
                    Recommended. They go out one at a time, at a safe pace, oldest first. Instagram only allows a private
                    reply for 7 days after a comment.
                  </span>
                </span>
              </label>
              <label className={`${styles.choice} ${!replyToWaiting ? styles.chosen : ""}`}>
                <input type="radio" name="waiting" checked={!replyToWaiting} onChange={() => setReplyToWaiting(false)} />
                <span>
                  <span className={styles.choiceTitle}>Skip them</span>
                  <span className={styles.choiceText}>Only comments from now on get a reply. These are marked as skipped by you.</span>
                </span>
              </label>
            </fieldset>
          </>
        ) : (
          <p className={styles.dialogText}>No comments are waiting. Automations will start replying to new comments again.</p>
        )}
      </Modal>
    </Card>
  );
}
