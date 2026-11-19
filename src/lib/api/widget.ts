import { api } from "./client";

export interface WidgetChatResponse {
  reply: string;
  session_id: string;
  agent_id: string;
  image_url?: string | null;
}

interface WidgetHistoryMessage {
  role: "user" | "assistant" | "system" | "human_agent";
  content: string;
  timestamp: string | null;
}

interface WidgetHistoryResponse {
  messages: WidgetHistoryMessage[];
  session_id: string;
}

/** One person who chatted through the website widget, with what is known about them. */
export interface WidgetVisitor {
  session_id: string;
  conversation_key: string;
  name: string | null;
  email: string | null;
  phone: string | null;
  /** Their device's time zone, e.g. "Asia/Kolkata": a rough guide to where they are. */
  timezone: string | null;
  language: string | null;
  device: string | null;
  browser: string | null;
  page_url: string | null;
  page_title: string | null;
  referrer: string | null;
  lead_label: string | null;
  lead_score: number | null;
  needs_callback: boolean;
  messages: number;
  last_message: string | null;
  first_seen_at: string | null;
  last_message_at: string | null;
}

// Mirrors the public, unauthenticated /widget/* routes an embedded site's own
// JS calls directly, used here only to drive the in-dashboard playground so
// a business owner can try their agent exactly as a real visitor would.
export const widgetApi = {
  sendMessage: (agentId: string, message: string, sessionId?: string) =>
    api.post<WidgetChatResponse>(`/widget/chat/${agentId}`, { message, session_id: sessionId }),

  /** Signed-in owner only: everyone who chatted, newest first. */
  visitors: (agentId: string, options: { knownOnly?: boolean; search?: string } = {}) => {
    const params = new URLSearchParams();
    if (options.knownOnly) params.set("known_only", "true");
    if (options.search) params.set("search", options.search);
    const query = params.toString();
    return api.get<{ visitors: WidgetVisitor[]; total: number; identified: number }>(
      `/widget/visitors/${agentId}${query ? `?${query}` : ""}`
    );
  },

  history: (agentId: string, sessionId: string) =>
    api.get<WidgetHistoryResponse>(`/widget/history/${agentId}?session_id=${encodeURIComponent(sessionId)}`),
};
