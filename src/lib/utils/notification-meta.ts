import type { IconName, Tone } from "@/components/ui/Icon/Icon";
import type { Notification } from "@/types/api";

interface NotificationMeta {
  icon: IconName;
  tone: Tone;
  /** Where clicking the notification takes you. */
  href: string | null;
}

function text(value: unknown): string {
  return typeof value === "string" ? value : "";
}

/** The conversation a message notification is about, when it can be worked out. */
function conversationLink(notification: Notification): string | null {
  const meta = notification.metadata ?? {};
  const explicit = text(meta.conversation_key);
  if (explicit) return `/inbox?c=${encodeURIComponent(explicit)}`;
  const platform = text(meta.platform);
  const who = text(meta.sender_id) || text(meta.from_number) || text(meta.phone) || text(meta.user_key);
  if (notification.agent_id && platform && who) {
    return `/inbox?c=${encodeURIComponent(`${notification.agent_id}:${platform}:${who}`)}`;
  }
  return "/inbox";
}

/** Icon, colour and destination for each kind of notification. */
export function notificationMeta(notification: Notification): NotificationMeta {
  const type = notification.type || "";
  if (type === "knowledge_gap_detected") return { icon: "bulb", tone: "amber", href: "/knowledge-gaps" };
  if (type === "human_handoff_required") return { icon: "team", tone: "red", href: conversationLink(notification) };
  if (type === "suspicious_activity_detected") return { icon: "shield", tone: "red", href: conversationLink(notification) };
  if (type.endsWith("_message_received")) {
    const tone: Tone = type.startsWith("instagram") ? "pink" : type.startsWith("whatsapp") ? "green" : "blue";
    return { icon: "comment", tone, href: conversationLink(notification) };
  }
  if (type.startsWith("instagram")) {
    return { icon: type.includes("alert") ? "alert" : "instagram", tone: type.includes("alert") || type.includes("disconnected") ? "red" : "pink", href: "/channels/instagram" };
  }
  if (type.startsWith("whatsapp_template")) {
    return { icon: "book", tone: type.includes("rejected") || type.includes("paused") ? "red" : "green", href: "/channels/whatsapp/templates" };
  }
  if (type === "whatsapp_order_placed" || type === "whatsapp_payment_claimed") return { icon: "box", tone: "green", href: "/channels/whatsapp?tab=shop" };
  if (type.startsWith("whatsapp_call")) return { icon: "phone", tone: type.includes("missed") ? "red" : "green", href: "/inbox" };
  if (type.startsWith("whatsapp")) {
    const bad = /alert|disconnected|red|rejected|restricted|disabled/.test(type);
    return { icon: bad ? "alert" : "plug", tone: bad ? "red" : "green", href: "/channels/whatsapp" };
  }
  if (type.startsWith("messenger")) return { icon: "plug", tone: type.includes("disconnected") ? "red" : "blue", href: "/channels/messenger" };
  return { icon: "bell", tone: "slate", href: null };
}

/** "Today", "Yesterday" or a date, for grouping a list of notifications. */
export function dayLabel(iso: string): string {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) return "Earlier";
  const today = new Date();
  const start = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
  const days = Math.round((start(today) - start(date)) / 86400000);
  if (days <= 0) return "Today";
  if (days === 1) return "Yesterday";
  return date.toLocaleDateString(undefined, { day: "numeric", month: "short" });
}
