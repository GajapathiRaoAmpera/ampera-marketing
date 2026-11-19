// Centralized date/time formatting - every component should format via
// these helpers instead of calling `.toLocaleString(undefined, ...)`
// directly, since `undefined` silently falls back to whatever timezone the
// browser/OS happens to be set to. Pass the current user's `timezone`
// (from useAuth()) so displayed times are consistent regardless of which
// device/browser views the dashboard.

const DEFAULT_TIMEZONE = "Asia/Kolkata";

// The backend stores every timestamp in UTC. Some endpoints send it without a zone
// ("2026-11-18T17:44:48.423"), and browsers read a zone-less date-time as LOCAL time,
// which put Indian users 5h30m off ("6h ago" for a message sent a minute earlier).
// A date-time with no "Z" or "+hh:mm" is therefore read as UTC here. Date-only
// strings and values that already carry a zone are left exactly as they are.
const HAS_TIME_WITHOUT_ZONE = /^\d{4}-\d{2}-\d{2}[T ]\d{2}:\d{2}(:\d{2}(\.\d+)?)?$/;

export function parseServerDate(value?: string | number | Date | null): Date {
  if (value instanceof Date) return value;
  if (typeof value === "number") return new Date(value);
  const text = (value ?? "").trim();
  return new Date(HAS_TIME_WITHOUT_ZONE.test(text) ? `${text.replace(" ", "T")}Z` : text);
}

export function formatDateTime(iso?: string | null, timezone?: string): string {
  if (!iso) return "";
  try {
    return parseServerDate(iso).toLocaleString("en-US", {
      timeZone: timezone || DEFAULT_TIMEZONE,
      dateStyle: "medium",
      timeStyle: "short",
    });
  } catch {
    return iso;
  }
}

export function formatTime(iso?: string | null, timezone?: string): string {
  if (!iso) return "";
  try {
    return parseServerDate(iso).toLocaleTimeString("en-US", {
      timeZone: timezone || DEFAULT_TIMEZONE,
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return "";
  }
}

export function formatDate(iso?: string | null, timezone?: string): string {
  if (!iso) return "";
  try {
    return parseServerDate(iso).toLocaleDateString("en-US", {
      timeZone: timezone || DEFAULT_TIMEZONE,
      year: "numeric",
      month: "short",
      day: "numeric",
    });
  } catch {
    return iso;
  }
}

export function formatShortDateTime(iso?: string | null, timezone?: string): string {
  if (!iso) return "";
  try {
    return parseServerDate(iso).toLocaleString("en-US", {
      timeZone: timezone || DEFAULT_TIMEZONE,
      month: "short",
      day: "numeric",
      hour: "numeric",
      minute: "2-digit",
    });
  } catch {
    return iso;
  }
}

// WhatsApp/Telegram-style chat date divider label ("Today", "Yesterday", or
// a full date), compared in the given timezone so "today" matches what the
// viewer actually sees on their clock, not the server's or browser's zone.
export function formatDateLabel(iso?: string | null, timezone?: string): string {
  if (!iso) return "";
  try {
    const tz = timezone || DEFAULT_TIMEZONE;
    const dayKey = (date: Date) =>
      date.toLocaleDateString("en-CA", { timeZone: tz }); // en-CA -> YYYY-MM-DD, sortable/comparable

    const target = parseServerDate(iso);
    const now = new Date();
    const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000);

    const targetKey = dayKey(target);
    if (targetKey === dayKey(now)) return "Today";
    if (targetKey === dayKey(yesterday)) return "Yesterday";
    return formatDate(iso, tz);
  } catch {
    return formatDate(iso, timezone);
  }
}

// Elapsed-time math needs no timezone: "5m ago" is the same regardless of zone.
export function formatRelativeTime(iso?: string | null): string {
  if (!iso) return "";
  const diffMs = Date.now() - parseServerDate(iso).getTime();
  const diffMin = Math.round(diffMs / 60000);
  if (diffMin < 1) return "now";
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  return `${Math.round(diffHr / 24)}d ago`;
}
