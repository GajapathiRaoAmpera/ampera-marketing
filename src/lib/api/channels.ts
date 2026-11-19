import { api } from "./client";

// ── Connections ──

export interface TelegramStatus {
  connected: boolean;
  bot_username?: string | null;
  bot_link?: string | null;
  webhook_url?: string | null;
  agent_id?: string | null;
  connected_at?: string | null;
  health?: { status: "healthy" | "degraded" | "disconnected"; pending_updates: number; last_error: string | null };
}

export const telegramApi = {
  status: () => api.get<TelegramStatus>("/channels/telegram/status"),
  connect: (botToken: string) =>
    api.post<{ success: boolean; bot_username: string; webhook_url: string }>("/channels/telegram/connect", { bot_token: botToken }),
  linkAgent: (agentId: string) => api.post("/channels/telegram/link-agent", { agent_id: agentId }),
  disconnect: () => api.delete("/channels/telegram/disconnect"),
};

export interface SmsProviderField {
  key: string;
  label: string;
  placeholder?: string;
  help?: string;
  secret?: boolean;
}

export interface SmsProvider {
  key: string;
  name: string;
  india_fit?: "best" | "good" | "limited" | null;
  fields: SmsProviderField[];
  /** Where in the provider's console the inbound address goes. */
  inbound_help: string;
  delivery_receipts: boolean;
}

export interface SmsStatus {
  connected: boolean;
  from_number?: string | null;
  provider?: string;
  provider_name?: string;
  inbound_help?: string | null;
  webhook_url?: string | null;
  agent_id?: string | null;
  connected_at?: string | null;
}

export interface SmsConnectResult {
  success: boolean;
  provider: string;
  from_number: string;
  webhook_configured: boolean;
  webhook_url: string;
  message: string;
}

export const smsApi = {
  status: () => api.get<SmsStatus>("/channels/sms/status"),
  providers: async () => (await api.get<{ providers: SmsProvider[] }>("/channels/sms/providers")).providers,
  /** Twilio's two fields go at the top level; every other provider's go in `credentials`. */
  connect: (provider: string, credentials: Record<string, string>, fromNumber: string) =>
    api.post<SmsConnectResult>(
      "/channels/sms/connect",
      provider === "twilio"
        ? { provider, from_number: fromNumber, account_sid: credentials.account_sid, auth_token: credentials.auth_token }
        : { provider, from_number: fromNumber, credentials }
    ),
  linkAgent: (agentId: string) => api.post("/channels/sms/link-agent", { agent_id: agentId }),
  disconnect: () => api.delete("/channels/sms/disconnect"),
};

export interface DiscordChannelOption {
  id: string;
  name: string;
}

export interface DiscordLookup {
  bot_id: string;
  bot_name: string;
  invite_url: string;
  servers: Array<{ id: string; name: string; channels: DiscordChannelOption[] }>;
}

export interface DiscordConnection {
  id: string;
  agent_id: string;
  bot_name: string;
  bot_id?: string;
  guild_id: string;
  guild_name: string;
  channel_ids: string[];
  respond_to_all: boolean;
  active: boolean;
  connected_at?: string | null;
  /** Why the bot is offline, when Discord refused it. */
  gateway_error?: string | null;
  /** Something that works without it, but the owner asked for and Discord refused. */
  gateway_warning?: string | null;
}

export const discordApi = {
  lookup: (botToken: string) => api.post<DiscordLookup>("/discord/lookup", { bot_token: botToken }),
  connect: (input: { agent_id: string; bot_token: string; guild_id: string; channel_ids: string[] }) =>
    api.post<{ success: boolean; bot_name: string; guild_name: string; invite_url: string; warnings: string[] }>(
      "/discord/connect",
      input
    ),
  connections: async () => (await api.get<{ connections: DiscordConnection[] }>("/discord/connections")).connections,
  channels: (connectionId: string) =>
    api.get<{ channels: DiscordChannelOption[]; selected: string[] }>(`/discord/connections/${connectionId}/channels`),
  update: (connectionId: string, input: { channel_ids?: string[] }) =>
    api.patch<DiscordConnection>(`/discord/connections/${connectionId}`, input),
  disconnect: (connectionId: string) => api.delete(`/discord/connections/${connectionId}`),
  /** Bring the bot online again after fixing a permission switch in the Developer Portal. */
  retry: (connectionId: string) => api.post(`/discord/connections/${connectionId}/retry`, {}),
};

export interface TwitterStatus {
  connected: boolean;
  /** False when this server has no X app credentials, so nobody can sign in with X. */
  configured: boolean;
  twitter_username?: string | null;
  agent_id?: string | null;
  connected_at?: string | null;
  problem?: string | null;
  last_checked_at?: string | null;
  check_every_seconds?: number;
}

export const twitterApi = {
  status: () => api.get<TwitterStatus>("/channels/twitter/status"),
  // Full-page redirect to X's sign-in; X sends the browser back to /channels/twitter.
  connect: async () => (await api.get<{ authorization_url: string }>("/channels/twitter/connect")).authorization_url,
  linkAgent: (agentId: string) => api.post("/channels/twitter/link-agent", { agent_id: agentId }),
  disconnect: () => api.delete("/channels/twitter/disconnect"),
};

// ── Everything beyond connect, shared by Telegram, SMS, Discord and X ──

export type HubChannel = "telegram" | "sms" | "discord" | "twitter";

export type ChannelMenuAction = "ask" | "url" | "products" | "human";

export interface ChannelMenuItem {
  title: string;
  action: ChannelMenuAction;
  value: string;
}

export interface ChannelCommand {
  command: string;
  description: string;
  reply: string;
}

export interface ChannelKeywordFlow {
  keywords: string[];
  match: "contains" | "exact";
  reply: string;
  enabled: boolean;
}

export interface ChannelSettings {
  welcome_message: string;
  menu: ChannelMenuItem[];
  commands: ChannelCommand[];
  keyword_flows: ChannelKeywordFlow[];
  away: { enabled: boolean; timezone: string; start: string; end: string; days: number[]; message: string };
  group_mode: "mention" | "all" | "off";
  reply_in_dms: boolean;
  understand_media: boolean;
  collect_phone: boolean;
  hot_lead_alert: { enabled: boolean };
  signature: string;
  member_welcome: { enabled: boolean; message: string };
  sync_errors?: string[];
}

export interface ChannelContact {
  user_key: string;
  name: string | null;
  username: string | null;
  kind: "private" | "group" | "member";
  phone: string | null;
  email: string | null;
  lead_label: string | null;
  lead_score: number | null;
  source: { ref: string | null; name: string | null } | null;
  opted_out: boolean;
  blocked: boolean;
  needs_callback: boolean;
  messages: number;
  first_seen_at: string | null;
  last_inbound_at: string | null;
}

export interface ChannelLink {
  id: string;
  name: string;
  ref: string;
  url: string;
  opening_message: string;
  opens: number;
  people: number;
  hot_leads: number;
}

export interface ChannelBroadcast {
  id: string;
  message: string;
  status: string;
  lead_label: string | null;
  source_ref: string | null;
  sent: number;
  failed: number;
  skipped: number;
  created_at: string | null;
}

export interface ChannelAnalytics {
  days: number;
  total_contacts: number;
  new_contacts: number;
  messages_received: number;
  messages_sent: number;
  instant_answers: number;
  callbacks_waiting: number;
  opted_out: number;
  leads: Record<string, number>;
  sources: Array<{ name: string; people: number; hot_leads: number }>;
  new_per_day: Array<{ date: string; count: number }>;
}

export interface ChannelQr {
  url: string;
  qr_data_uri: string;
}

/** `connectionId` only matters on Discord, when more than one server is connected. */
export function channelHubApi(channel: HubChannel, connectionId?: string) {
  const base = `/channels/${channel}/hub`;
  const scope = connectionId ? `connection_id=${encodeURIComponent(connectionId)}` : "";
  const url = (path: string, query = "") => {
    const qs = [scope, query].filter(Boolean).join("&");
    return `${base}${path}${qs ? `?${qs}` : ""}`;
  };

  return {
    settings: () => api.get<ChannelSettings>(url("/settings")),
    saveSettings: (input: Partial<ChannelSettings>) => api.put<ChannelSettings>(url("/settings"), input),

    contacts: async (search?: string) =>
      (await api.get<{ contacts: ChannelContact[] }>(url("/contacts", search ? `search=${encodeURIComponent(search)}` : ""))).contacts,
    send: (userKey: string, text: string) => api.post(url(`/contacts/${encodeURIComponent(userKey)}/send`), { text }),

    links: async () => (await api.get<{ links: ChannelLink[] }>(url("/links"))).links,
    createLink: (name: string, openingMessage: string) =>
      api.post<ChannelQr & { ref: string }>(url("/links"), { name, opening_message: openingMessage }),
    linkQr: (ref: string) => api.get<ChannelQr>(url(`/links/${encodeURIComponent(ref)}/qr`)),
    deleteLink: (ref: string) => api.delete(url(`/links/${encodeURIComponent(ref)}`)),

    broadcasts: () =>
      api.get<{ broadcasts: ChannelBroadcast[]; audience: { total: number; reachable: number; unreachable: number } }>(url("/broadcasts")),
    sendBroadcast: (input: { message: string; lead_label?: string; source_ref?: string }) => api.post(url("/broadcasts"), input),

    analytics: (days: number) => api.get<ChannelAnalytics>(url("/analytics", `days=${days}`)),
  };
}
