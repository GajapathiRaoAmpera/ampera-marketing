import { api } from "./client";

export interface MessengerConnection {
  id: string;
  page_id: string;
  page_name: string;
  page_category?: string;
  agent_id?: string | null;
  webhook_subscribed: boolean;
  active: boolean;
  connected_at?: string | null;
  has_token: boolean;
}

interface ConnectResponse {
  authorization_url: string;
  state: string;
  expires_in_seconds: number;
}

interface ConnectionsResponse {
  connections: MessengerConnection[];
  count: number;
}

interface ManualConnectResponse {
  status: string;
  page_id: string;
  page_name: string;
  webhook_configured: boolean;
  agent_id: string | null;
}

export const messengerApi = {
  // Full-page redirect flow - Messenger's Page-linking OAuth has no JS SDK
  // popup equivalent, so the browser navigates to Meta's dialog directly.
  connect: async (): Promise<{ url: string }> => {
    const res = await api.get<ConnectResponse>("/channels/messenger/connect");
    return { url: res.authorization_url };
  },

  listConnections: async (): Promise<MessengerConnection[]> => {
    const res = await api.get<ConnectionsResponse>("/channels/messenger/connections");
    return res.connections;
  },

  linkAgent: (pageId: string, agentId: string) =>
    api.post(`/channels/messenger/link-agent`, { agent_id: agentId, page_id: pageId }),

  disconnect: (pageId: string) =>
    api.delete(`/channels/messenger/disconnect?page_id=${encodeURIComponent(pageId)}`),

  // Alternative to the OAuth redirect - paste a Page ID + Page access token
  // directly (e.g. from Meta's Graph API Explorer or a System User token).
  manualConnect: (pageId: string, pageAccessToken: string, agentId?: string) =>
    api.post<ManualConnectResponse>("/channels/messenger/manual-connect", {
      page_id: pageId,
      page_access_token: pageAccessToken,
      agent_id: agentId,
    }),
};

// ── Everything beyond connect: chat setup, contacts, growth, analytics ──

export type MessengerAction =
  | "ask" | "url" | "products" | "human" | "book" | "whatsapp" | "share_phone" | "share_email" | "rate";

export interface MessengerActionItem {
  title: string;
  action: MessengerAction;
  value: string;
}

export interface MessengerKeywordFlow {
  id?: string;
  name: string;
  keywords: string[];
  match: "contains" | "exact";
  reply: string;
  action: MessengerAction | "none";
  value: string;
  enabled: boolean;
}

export interface MessengerSettings {
  greeting_text: string;
  get_started: { enabled: boolean; welcome_message: string };
  persistent_menu: MessengerActionItem[];
  ice_breakers: string[];
  quick_replies: { enabled: boolean; items: MessengerActionItem[] };
  keyword_flows: MessengerKeywordFlow[];
  source_openers: Array<{ ref: string; message: string }>;
  away: { enabled: boolean; timezone: string; start: string; end: string; days: number[]; message: string };
  nudge: { enabled: boolean; after_hours: number; message: string };
  hot_lead_alert: { enabled: boolean; telegram: boolean };
  handover: { auto_pause_on_page_reply: boolean; pass_to_page_inbox: boolean };
  whatsapp_number: string;
  persona: { name: string; picture_url: string; id?: string | null };
  booking: { enabled: boolean; slots: string[] };
  comments: { ai_reply: boolean };
  understand_media: boolean;
  sync_errors?: string[];
}

export interface MessengerHealth {
  status: "healthy" | "degraded" | "disconnected";
  token_valid: boolean;
  missing_fields: string[];
  comments_ready?: boolean;
  agent_linked: boolean;
  error: string | null;
}

export interface MessengerWindow {
  state: "open" | "human_agent" | "closed";
  last_inbound_at: string | null;
  standard_closes_at: string | null;
  human_closes_at: string | null;
}

export interface MessengerContact {
  psid: string;
  name: string | null;
  profile_pic: string | null;
  phone: string | null;
  email: string | null;
  lead_label: string | null;
  lead_score: number | null;
  source: { type?: string; ref?: string; ad_id?: string } | null;
  window: MessengerWindow;
  thread_owner: "bot" | "page_inbox";
  subscribed: boolean;
  needs_callback: boolean;
  rating: number | null;
  linked_profiles: Array<{ channel: string; key: string }>;
  first_seen_at: string | null;
}

export type MessengerSendKind =
  | "text" | "products" | "rating" | "whatsapp" | "receipt" | "coupon" | "optin" | "link_button" | "share_phone" | "share_email";

export interface MessengerSendInput {
  kind: MessengerSendKind;
  text?: string;
  update_type?: "order_update" | "event_update" | "account_update";
  title?: string;
  subtitle?: string;
  url?: string;
  button_title?: string;
  coupon_code?: string;
  order_number?: string;
  items?: Array<{ title: string; quantity: number; price: number }>;
}

export interface MessengerLink {
  id: string;
  name: string;
  ref: string;
  url: string;
  opens: number;
  people: number;
  hot_leads: number;
}

export interface MessengerCommentRule {
  id: string;
  name: string;
  keywords: string[];
  match: "contains" | "exact";
  post_ids: string[];
  private_message: string;
  public_reply: string;
  enabled: boolean;
  runs: number;
}

export interface MessengerCommentEvent {
  author: string | null;
  text: string;
  private: boolean;
  public: boolean;
  ai: boolean;
  error: string | null;
  created_at: string | null;
}

export interface MessengerBroadcast {
  id: string;
  message: string;
  audience: "open_window" | "subscribers" | "both";
  status: string;
  sent: number;
  failed: number;
  skipped: number;
  created_at: string | null;
}

export interface MessengerAnalytics {
  days: number;
  total_contacts: number;
  new_contacts: number;
  open_windows: number;
  missed_windows: number;
  subscribers: number;
  callbacks_waiting: number;
  avg_response_seconds: number | null;
  avg_rating: number | null;
  ratings_count: number;
  leads: Record<string, number>;
  sources: Array<{ name: string; people: number; hot_leads: number }>;
  new_per_day: Array<{ date: string; count: number }>;
}

const page = (pageId: string) => `/channels/messenger/pages/${encodeURIComponent(pageId)}`;

export const messengerPageApi = {
  health: (pageId: string) => api.get<MessengerHealth>(`${page(pageId)}/health`),
  resubscribe: (pageId: string) => api.post<{ comments_ready: boolean }>(`${page(pageId)}/resubscribe`, {}),
  settings: (pageId: string) => api.get<MessengerSettings>(`${page(pageId)}/settings`),
  saveSettings: (pageId: string, input: Partial<MessengerSettings>) =>
    api.put<MessengerSettings>(`${page(pageId)}/settings`, input),

  contacts: async (pageId: string, search?: string) => {
    const qs = search ? `?search=${encodeURIComponent(search)}` : "";
    return (await api.get<{ contacts: MessengerContact[] }>(`${page(pageId)}/contacts${qs}`)).contacts;
  },
  send: (pageId: string, psid: string, input: MessengerSendInput) =>
    api.post(`${page(pageId)}/contacts/${psid}/send`, input),
  handover: (pageId: string, psid: string, to: "page_inbox" | "bot") =>
    api.post(`${page(pageId)}/contacts/${psid}/handover`, { to }),
  summary: async (pageId: string, psid: string) =>
    (await api.post<{ summary: string }>(`${page(pageId)}/contacts/${psid}/summary`, {})).summary,
  importHistory: (pageId: string) =>
    api.post<{ imported: number; skipped: number; messages: number }>(`${page(pageId)}/import`, {}),

  links: async (pageId: string) => (await api.get<{ links: MessengerLink[] }>(`${page(pageId)}/links`)).links,
  createLink: (pageId: string, name: string, openingMessage: string) =>
    api.post<{ ref: string; url: string; qr_data_uri: string }>(`${page(pageId)}/links`, { name, opening_message: openingMessage }),
  linkQr: (pageId: string, ref: string) =>
    api.get<{ url: string; qr_data_uri: string }>(`${page(pageId)}/links/${ref}/qr`),
  deleteLink: (pageId: string, ref: string) => api.delete(`${page(pageId)}/links/${ref}`),

  commentRules: (pageId: string) =>
    api.get<{ rules: MessengerCommentRule[]; recent: MessengerCommentEvent[] }>(`${page(pageId)}/comment-rules`),
  saveCommentRule: (pageId: string, input: Omit<MessengerCommentRule, "id" | "runs">, ruleId?: string) =>
    ruleId
      ? api.patch(`${page(pageId)}/comment-rules/${ruleId}`, input)
      : api.post(`${page(pageId)}/comment-rules`, input),
  deleteCommentRule: (pageId: string, ruleId: string) => api.delete(`${page(pageId)}/comment-rules/${ruleId}`),

  broadcasts: (pageId: string) =>
    api.get<{ broadcasts: MessengerBroadcast[]; audience: { open_window: number; subscribers: number; total: number } }>(
      `${page(pageId)}/broadcasts`
    ),
  sendBroadcast: (pageId: string, input: { message: string; audience: MessengerBroadcast["audience"]; lead_label?: string }) =>
    api.post(`${page(pageId)}/broadcasts`, input),

  analytics: (pageId: string, days: number) => api.get<MessengerAnalytics>(`${page(pageId)}/analytics?days=${days}`),
};
