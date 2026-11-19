"use client";

import { useEffect, useMemo, useState } from "react";
import { instagramAutomationsApi, type InstagramAutomation, type InstagramExecution } from "@/lib/api";
import { Button, Skeleton } from "@/components/ui";
import { EVENT_ICON, Icon, IconTile } from "./icons";
import { relativeTime } from "./media";
import styles from "./workspace.module.scss";

const EVENT_LABEL: Record<string, string> = {
  comment: "Comment",
  live_comment: "Live comment",
  dm: "Direct message",
  story_reply: "Story reply",
  story_reaction: "Story reaction",
  story_mention: "Story mention",
  account_mention: "Mention",
  media_share: "Post shared in DM",
  referral: "Opened from link or ad",
  continuation: "Follow-up step",
};

const UNMATCHED: Record<string, string> = {
  no_matching_automation: "No automation matched",
  cooldown_active: "Skipped, answered this person recently",
  own_comment: "Your own reply, ignored",
  connection_not_found: "Account not connected",
};

type Outcome = { label: string; tone: "good" | "bad" | "warn" | "muted" };

function outcome(item: InstagramExecution): Outcome {
  switch (item.status) {
    case "succeeded":
      return { label: "Answered", tone: "good" };
    case "partial":
      return { label: "Partly answered", tone: "warn" };
    case "failed":
      return { label: "Failed", tone: "bad" };
    case "scheduled":
      return { label: "Waiting", tone: "warn" };
    case "moderated":
      return { label: "Comment removed", tone: "muted" };
    case "moderation_failed":
      return { label: "Couldn't remove", tone: "bad" };
    case "unmatched":
      return { label: UNMATCHED[item.unmatched_reason || ""] || "Not answered", tone: "muted" };
    default:
      return { label: String(item.status || "Unknown"), tone: "muted" };
  }
}

const TONE_COLOR: Record<Outcome["tone"], string> = {
  good: "var(--color-success-600)",
  bad: "var(--color-danger-600)",
  warn: "var(--color-warning-600)",
  muted: "var(--color-text-tertiary)",
};

function failureReason(item: InstagramExecution): string | null {
  const failure = (item.action_results || []).find((result) => result.status === "failed");
  const error = failure && typeof failure.error === "string" ? failure.error : null;
  if (!error) return null;
  if (error.includes("24-hour")) return "Instagram only allows messages within 24 hours of their last message.";
  if (error.includes("eligibility has expired")) return "The comment is more than 7 days old.";
  return error.length > 140 ? `${error.slice(0, 140)}…` : error;
}

export function ActivityList({ executions, automations }: { executions: InstagramExecution[]; automations: InstagramAutomation[] }) {
  const names = useMemo(() => Object.fromEntries(automations.map((item) => [item.id, item.name])), [automations]);
  if (executions.length === 0) {
    return <p className={styles.muted}>Nothing yet. As soon as someone comments or messages you, it shows up here.</p>;
  }
  return (
    <ul className={styles.events}>
      {executions.map((item) => {
        const result = outcome(item);
        const why = item.status === "failed" || item.status === "partial" ? failureReason(item) : null;
        return (
          <li key={String(item.id)} className={styles.event}>
            <IconTile size="sm" {...(item.status === "moderated" ? EVENT_ICON.moderated : EVENT_ICON[item.event_type] ?? EVENT_ICON.comment)} />
            <div className={styles.eventBody}>
              <span>
                <strong style={{ color: TONE_COLOR[result.tone] }}>{result.label}</strong>
                {" · "}
                {EVENT_LABEL[item.event_type] || item.event_type}
                {item.subject_username ? ` from @${item.subject_username}` : ""}
              </span>
              {item.text && <q>{item.text}</q>}
              <span className={styles.eventMeta}>
                {item.automation_id && names[item.automation_id] ? `Automation: ${names[item.automation_id]}` : ""}
                {why ? `${item.automation_id && names[item.automation_id] ? " · " : ""}${why}` : ""}
              </span>
            </div>
            <span className={styles.eventTime}>{relativeTime(item.created_at)}</span>
          </li>
        );
      })}
    </ul>
  );
}

type DatePreset = "today" | "7" | "30" | "90" | "custom";

const DATE_PRESETS: Array<{ value: DatePreset; label: string }> = [
  { value: "today", label: "Today" },
  { value: "7", label: "7 days" },
  { value: "30", label: "30 days" },
  { value: "90", label: "90 days" },
  { value: "custom", label: "Custom" },
];

const RESULTS: Array<{ value: string; label: string; statuses?: string[] }> = [
  { value: "all", label: "Any result" },
  { value: "answered", label: "Answered", statuses: ["succeeded", "partial"] },
  { value: "failed", label: "Failed", statuses: ["failed", "moderation_failed"] },
  { value: "waiting", label: "Waiting", statuses: ["scheduled"] },
  { value: "unmatched", label: "Not answered", statuses: ["unmatched"] },
  { value: "removed", label: "Removed", statuses: ["moderated"] },
];

const TYPES: Array<{ value: string; label: string; types?: string[] }> = [
  { value: "all", label: "Everything" },
  { value: "comments", label: "Comments", types: ["comment", "live_comment"] },
  { value: "dms", label: "DMs", types: ["dm", "media_share", "referral"] },
  { value: "stories", label: "Stories", types: ["story_reply", "story_reaction", "story_mention"] },
];

const PAGE = 40;

function dayStart(offsetDays = 0): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() - offsetDays);
  return d;
}

/** The [since, until) window for a preset, in the viewer's own time zone. */
function windowFor(preset: DatePreset, from: string, to: string): { since?: string; until?: string; live: boolean } {
  if (preset === "today") return { since: dayStart().toISOString(), live: true };
  if (preset === "custom") {
    const since = from ? new Date(`${from}T00:00:00`) : undefined;
    const until = to ? new Date(`${to}T00:00:00`) : undefined;
    if (until) until.setDate(until.getDate() + 1);
    return { since: since?.toISOString(), until: until?.toISOString(), live: !until || until.getTime() > Date.now() };
  }
  return { since: dayStart(Number(preset) - 1).toISOString(), live: true };
}

interface ActivityTabProps {
  businessId: string;
  connectionId: string;
  automations: InstagramAutomation[];
  /** Shown right now; live updates pause while it is hidden. */
  active?: boolean;
}

export function ActivityTab({ businessId, connectionId, automations, active = true }: ActivityTabProps) {
  const [preset, setPreset] = useState<DatePreset>("7");
  const [from, setFrom] = useState("");
  const [to, setTo] = useState("");
  const [result, setResult] = useState("all");
  const [type, setType] = useState("all");
  const [automationId, setAutomationId] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [search, setSearch] = useState("");
  const [rows, setRows] = useState<InstagramExecution[] | null>(null);
  const [hasMore, setHasMore] = useState(false);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Typing pauses for a moment before searching, so each key press isn't a request.
  useEffect(() => {
    const timer = window.setTimeout(() => setSearch(searchInput), 350);
    return () => window.clearTimeout(timer);
  }, [searchInput]);

  const filters = useMemo(() => {
    const window_ = windowFor(preset, from, to);
    return {
      connectionId,
      since: window_.since,
      until: window_.until,
      live: window_.live,
      statuses: RESULTS.find((item) => item.value === result)?.statuses,
      eventTypes: TYPES.find((item) => item.value === type)?.types,
      search,
    };
  }, [connectionId, preset, from, to, result, type, search]);

  useEffect(() => {
    let cancelled = false;
    const { live: _live, ...query } = filters;
    void _live;
    instagramAutomationsApi
      .executions(businessId, automationId || undefined, { ...query, limit: PAGE })
      .then((response) => {
        if (cancelled) return;
        const list = (response.executions || []).filter((item) => item.event_type !== "continuation");
        setRows(list);
        setHasMore((response.executions || []).length >= PAGE);
        setError(null);
      })
      .catch(() => !cancelled && setError("Activity couldn't be loaded. Check your connection and try again."));

    return () => {
      cancelled = true;
    };
  }, [businessId, automationId, filters]);

  // While the range includes now and the tab is on screen, new events appear
  // on their own (added on top; older pages already loaded are kept).
  useEffect(() => {
    if (!active || !filters.live) return;
    let cancelled = false;
    const { live: _live, ...query } = filters;
    void _live;
    const timer = window.setInterval(() => {
      if (document.visibilityState !== "visible") return;
      instagramAutomationsApi
        .executions(businessId, automationId || undefined, { ...query, limit: PAGE })
        .then((response) => {
          if (cancelled) return;
          const fresh = (response.executions || []).filter((item) => item.event_type !== "continuation");
          setRows((current) => {
            if (!current) return fresh;
            const known = new Set(current.map((item) => String(item.id)));
            const added = fresh.filter((item) => !known.has(String(item.id)));
            return added.length ? [...added, ...current] : current;
          });
        })
        .catch(() => undefined);
    }, 8000);
    return () => {
      cancelled = true;
      window.clearInterval(timer);
    };
  }, [active, businessId, automationId, filters]);

  async function loadMore() {
    if (!rows?.length) return;
    setLoadingMore(true);
    const { live: _live, ...query } = filters;
    void _live;
    try {
      const response = await instagramAutomationsApi.executions(businessId, automationId || undefined, {
        ...query,
        limit: PAGE,
        before: rows[rows.length - 1].created_at,
      });
      const older = (response.executions || []).filter((item) => item.event_type !== "continuation");
      setRows((current) => [...(current ?? []), ...older]);
      setHasMore((response.executions || []).length >= PAGE);
    } catch {
      setError("Couldn't load more. Try again.");
    } finally {
      setLoadingMore(false);
    }
  }

  const filtered = result !== "all" || type !== "all" || automationId || search || preset !== "7";

  function resetFilters() {
    setPreset("7");
    setFrom("");
    setTo("");
    setResult("all");
    setType("all");
    setAutomationId("");
    setSearchInput("");
  }

  return (
    <div className={styles.panel}>
      <div className={styles.sectionTitle}>
        <h3>Activity</h3>
        {filters.live && (
          <span className={styles.liveDot}>
            <i aria-hidden /> Live
          </span>
        )}
      </div>

      <div className={styles.activityFilters}>
        <div className={styles.periods} role="group" aria-label="Date range">
          {DATE_PRESETS.map((item) => (
            <button key={item.value} type="button" aria-pressed={preset === item.value} onClick={() => setPreset(item.value)}>
              {item.label}
            </button>
          ))}
        </div>
        {preset === "custom" && (
          <div className={styles.dateRange}>
            <label>
              From
              <input type="date" value={from} max={to || undefined} onChange={(event) => setFrom(event.target.value)} />
            </label>
            <label>
              To
              <input type="date" value={to} min={from || undefined} onChange={(event) => setTo(event.target.value)} />
            </label>
          </div>
        )}
        <div className={styles.filterSelects}>
          <select aria-label="Result" value={result} onChange={(event) => setResult(event.target.value)}>
            {RESULTS.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select aria-label="Type" value={type} onChange={(event) => setType(event.target.value)}>
            {TYPES.map((item) => (
              <option key={item.value} value={item.value}>
                {item.label}
              </option>
            ))}
          </select>
          <select aria-label="Automation" value={automationId} onChange={(event) => setAutomationId(event.target.value)}>
            <option value="">All automations</option>
            {automations.map((item) => (
              <option key={item.id} value={item.id}>
                {item.name}
              </option>
            ))}
          </select>
          <label className={styles.searchBox}>
            <Icon name="search" size={15} />
            <input
              type="search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Search text or @username"
              aria-label="Search activity"
            />
          </label>
        </div>
        {filtered && (
          <button type="button" className={styles.clearFilters} onClick={resetFilters}>
            Clear filters
          </button>
        )}
      </div>

      {error && !rows ? (
        <p className={styles.muted}>{error}</p>
      ) : rows === null ? (
        <Skeleton height={260} />
      ) : (
        <>
          <span className={styles.muted}>
            {rows.length === 0 ? "" : `Showing ${rows.length}${hasMore ? "+" : ""} ${rows.length === 1 ? "event" : "events"}`}
          </span>
          {rows.length === 0 ? (
            <p className={styles.muted}>{filtered ? "Nothing matches these filters." : "Nothing yet. As soon as someone comments or messages you, it shows up here."}</p>
          ) : (
            <ActivityList executions={rows} automations={automations} />
          )}
          {hasMore && (
            <Button variant="secondary" size="sm" isLoading={loadingMore} onClick={() => void loadMore()} style={{ justifySelf: "center" }}>
              Load older activity
            </Button>
          )}
        </>
      )}
    </div>
  );
}
