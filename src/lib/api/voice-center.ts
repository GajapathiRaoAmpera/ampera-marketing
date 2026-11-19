import { api } from "./client";

// Call center: rules, history, analytics, campaigns and the do-not-call list
// (backend: app/api/routes/voice/call_center.py).

export type CallDisposition =
  | "booked" | "interested" | "callback_requested" | "info_provided" | "message_taken"
  | "not_interested" | "complaint" | "wrong_number" | "do_not_call" | "transferred" | "other"
  | "voicemail" | "no_answer" | "busy" | "failed" | "no_response";

export const DISPOSITION_LABELS: Record<CallDisposition, string> = {
  booked: "Booked",
  interested: "Interested",
  callback_requested: "Wants a callback",
  info_provided: "Question answered",
  message_taken: "Message taken",
  not_interested: "Not interested",
  complaint: "Complaint",
  wrong_number: "Wrong number",
  do_not_call: "Asked not to be called",
  transferred: "Transferred to team",
  other: "Other",
  voicemail: "Voicemail",
  no_answer: "No answer",
  busy: "Busy",
  failed: "Failed",
  no_response: "Caller didn't speak",
};

export type DispositionTone = "success" | "warning" | "danger" | "info" | "neutral";

export function dispositionTone(value?: string | null): DispositionTone {
  if (!value) return "neutral";
  if (["booked", "interested", "callback_requested", "message_taken"].includes(value)) return "success";
  if (["complaint", "do_not_call", "failed"].includes(value)) return "danger";
  if (["voicemail", "no_answer", "busy", "no_response"].includes(value)) return "warning";
  if (["info_provided", "transferred"].includes(value)) return "info";
  return "neutral";
}

export function dispositionLabel(value?: string | null): string {
  return value ? DISPOSITION_LABELS[value as CallDisposition] ?? value : "";
}

export function formatDuration(seconds?: number | null): string {
  if (seconds === null || seconds === undefined) return "";
  const minutes = Math.floor(seconds / 60);
  const rest = seconds % 60;
  return minutes ? `${minutes}m ${rest.toString().padStart(2, "0")}s` : `${rest}s`;
}

export interface CallPolicy {
  timezone: string;
  business_hours_enabled: boolean;
  business_days: number[];
  business_open: string;
  business_close: string;
  after_hours_mode: "ai_answers" | "take_message";
  after_hours_message: string;
  calling_window_enabled: boolean;
  calling_days: number[];
  calling_start: string;
  calling_end: string;
  max_call_minutes: number;
  transfer_number: string;
  transfer_on_request: boolean;
  disclosure_enabled: boolean;
  disclosure_text: string;
  voicemail_detection: boolean;
  voicemail_message: string;
  retry_enabled: boolean;
  retry_max_attempts: number;
  retry_delay_minutes: number;
  retry_on_voicemail: boolean;
  missed_call_text_enabled: boolean;
  missed_call_text: string;
  post_call_text_enabled: boolean;
  post_call_text: string;
  auto_callback_enabled: boolean;
  remember_callers: boolean;
  /** Ring back an inbound caller who hung up before saying why / who left without an answer. */
  callback_dropped_enabled: boolean;
  callback_unresolved_enabled: boolean;
  callback_delay_minutes: number;
  callback_daily_limit: number;
  /** The call's outcome on WhatsApp, through an approved template ({{1}} name, {{2}} outcome). */
  post_call_whatsapp_enabled: boolean;
  post_call_whatsapp_template: string;
  /** The calling window must hold where the person is, and a recorded call always says so. */
  callee_local_window: boolean;
  enforce_recording_notice: boolean;
  /** Text a message left after hours to the desk it belongs to, when that desk has a number. */
  voicemail_route_text: boolean;
  /** Estimated monthly spend limit in rupees (0 = none). */
  monthly_cost_cap: number;
  cost_alert_percent: number;
  /** Two-letter country codes calls may be placed to. Empty means only the country of your own number. */
  allowed_countries: string[];
  /** Most outbound calls in any 24 hours, however they are started. */
  outbound_daily_cap: number;
  /** End abusive callers and recordings, and don't answer a number that keeps ringing. */
  abuse_guard: boolean;
  inbound_rate_limit: number;
  /** The business's current local time, for example "Tue 14:05". Read only. */
  local_time?: string;
}

export interface CallRow {
  id: string;
  call_sid: string;
  direction: "inbound" | "outbound";
  number: string;
  name: string;
  status: string;
  started_at: string | null;
  ended_at: string | null;
  duration_seconds: number | null;
  connected: boolean;
  disposition: CallDisposition | null;
  outcome: string;
  sentiment: "positive" | "neutral" | "negative" | null;
  qa_score: number | null;
  resolved: boolean | null;
  starred: boolean;
  tags: string[];
  has_notes: boolean;
  attempt: number;
  campaign_id: string | null;
  after_hours: boolean;
  transferred: boolean;
  returning_caller: boolean;
  lead_label: string | null;
  has_recording: boolean;
  retry_at: string | null;
  callback_scheduled: boolean;
  voicemail_left: boolean;
  /** Set while a call is on, when the caller is getting angry (see app/services/voice/live_sentiment.py). */
  live_alert?: { level: "warn" | "urgent"; reason: string; at: string } | null;
  /** Which A/B variant of the agent this call got. */
  experiment?: { name: string; variant: string } | null;
}

export interface LiveCall extends CallRow {
  last_line: string;
  last_speaker: "caller" | "agent" | null;
  /** True for real-time calls, whose audio can be heard in the browser. */
  listenable?: boolean;
}

export interface CallLogFilters {
  direction?: string;
  disposition?: string;
  q?: string;
  starred?: boolean;
  campaign_id?: string;
  connected?: boolean;
  days?: number;
  limit?: number;
  offset?: number;
}

export interface VoiceInsight {
  tone: "good" | "warn" | "info";
  action: "rules" | "campaigns" | "calls" | "dnc" | "knowledge" | "flow";
  title: string;
  detail: string;
}

export interface VoiceAnalytics {
  days: number;
  timezone: string;
  totals: {
    calls: number; inbound: number; outbound: number; connected: number; outbound_connected: number;
    bookings: number; positive_outcomes: number; voicemails: number; opt_outs: number; transferred: number;
    after_hours: number; returning_callers: number; callbacks_scheduled: number; human_requests_unmet: number;
    missed_inbound: number; connect_rate: number | null; outbound_connect_rate: number | null;
    resolved_rate: number | null; avg_duration_seconds: number | null; total_minutes: number;
    avg_qa_score: number | null; avg_agent_talk_ratio: number | null;
  };
  previous: { calls: number; connected: number; bookings: number };
  by_day: { date: string; inbound: number; outbound: number; connected: number }[];
  by_hour: { hour: number; calls: number; connected: number; outbound: number; outbound_connected: number }[];
  dispositions: { key: CallDisposition; count: number }[];
  sentiment: { positive: number; neutral: number; negative: number };
  unanswered_questions: { question: string; count: number }[];
  queued: { scheduled: number; retries: number; callbacks: number };
  insights: VoiceInsight[];
}

export interface DncEntry {
  number: string;
  reason: string;
  source: "manual" | "caller_request" | "ai_detected";
  block_inbound: boolean;
  created_at: string | null;
}

export interface CampaignContact {
  number: string;
  name?: string;
  variables?: Record<string, string>;
}

export interface VoiceCampaign {
  id: string;
  name: string;
  context: string;
  opening_message?: string | null;
  status: "running" | "paused" | "canceled" | "completed";
  contacts_total: number;
  calls_per_minute: number;
  start_at: string | null;
  created_at: string | null;
  excluded: { invalid?: number; duplicates?: number; do_not_call?: number };
  pending: number;
  skipped: number;
  needs_review: number;
  next_call_at: string | null;
  attempts: number;
  reached: number;
  voicemails: number;
  positive: number;
  booked: number;
  opt_outs: number;
  dispositions: { key: CallDisposition; count: number }[];
}

export interface CampaignDraft {
  name: string;
  context: string;
  opening_message?: string;
  contacts: CampaignContact[];
  calls_per_minute: number;
  start_at?: string;
  default_country_code?: string;
}

export interface OutboundCallOptions {
  opening_message?: string;
  context?: string;
  contact_name?: string;
}

function queryString(filters: CallLogFilters): string {
  const params = new URLSearchParams();
  Object.entries(filters).forEach(([key, value]) => {
    if (value !== undefined && value !== "" && value !== false) params.set(key, String(value));
  });
  const text = params.toString();
  return text ? `?${text}` : "";
}

export interface VoiceProviderField {
  key: string;
  label: string;
  secret?: boolean;
  placeholder?: string;
  help?: string;
}

export interface VoiceProviderOption {
  key: string;
  name: string;
  market: "india" | "global" | "both";
  india_fit: "best" | "good" | "limited";
  summary: string;
  best_for: string;
  pricing: string;
  trial: string;
  setup: string;
  strengths: string[];
  limits: string[];
  url: string;
  connectable: boolean;
  fields: VoiceProviderField[];
  inbound_help: string;
  features: { key: string; label: string; supported: boolean }[];
}

const base = "/channels/voice";

export const voiceCenterApi = {
  providers: () => api.get<{ reviewed: string; providers: VoiceProviderOption[] }>(`${base}/providers`),

  getPolicy: () => api.get<CallPolicy>(`${base}/policy`),
  savePolicy: (policy: CallPolicy) => {
    const body = { ...policy };
    delete body.local_time;
    return api.put<CallPolicy>(`${base}/policy`, body);
  },

  analytics: (days: number) => api.get<VoiceAnalytics>(`${base}/analytics?days=${days}`),

  callLog: (filters: CallLogFilters = {}) =>
    api.get<{ calls: CallRow[]; total: number }>(`${base}/call-log${queryString(filters)}`),
  exportUrl: (filters: CallLogFilters = {}) => `/api/backend${base}/call-log/export${queryString(filters)}`,
  reviewCall: (callId: string, review: { starred?: boolean; notes?: string; tags?: string[]; disposition?: string }) =>
    api.patch<{ success: boolean }>(`${base}/calls/${encodeURIComponent(callId)}/review`, review),

  live: () => api.get<{ calls: LiveCall[] }>(`${base}/live`),
  hangup: (callId: string) => api.post<{ success: boolean }>(`${base}/calls/${encodeURIComponent(callId)}/hangup`),

  callNow: (toNumber: string, options: OutboundCallOptions = {}) =>
    api.post<{ success: boolean; call_sid: string }>(`${base}/outbound`, { to_number: toNumber, ...options }),
  scheduleCall: (toNumber: string, scheduledAt: string, options: OutboundCallOptions = {}) =>
    api.post<{ id: string }>(`${base}/schedules`, { to_number: toNumber, scheduled_at: scheduledAt, ...options }),

  listDnc: (q?: string) => api.get<{ numbers: DncEntry[]; total: number }>(`${base}/dnc${q ? `?q=${encodeURIComponent(q)}` : ""}`),
  addDnc: (numbers: string[], options: { reason?: string; block_inbound?: boolean; default_country_code?: string } = {}) =>
    api.post<{ added: number; invalid: number }>(`${base}/dnc`, { numbers, ...options }),
  removeDnc: (number: string) => api.delete<{ success: boolean }>(`${base}/dnc/${encodeURIComponent(number)}`),

  listCampaigns: async () => (await api.get<{ campaigns: VoiceCampaign[] }>(`${base}/campaigns`)).campaigns,
  createCampaign: (draft: CampaignDraft) => api.post<VoiceCampaign>(`${base}/campaigns`, draft),
  campaignAction: (id: string, action: "pause" | "resume" | "cancel") =>
    api.post<VoiceCampaign>(`${base}/campaigns/${id}/action`, { action }),
};

/** Reads pasted lines or a CSV into contacts. Accepts "number", "number, name"
 *  or a header row naming the columns; extra columns become {placeholders}. */
export function parseContactText(text: string): CampaignContact[] {
  const lines = text.split(/\r?\n/).map((line) => line.trim()).filter(Boolean);
  if (!lines.length) return [];
  const split = (line: string) => line.split(/[,;\t]/).map((cell) => cell.trim().replace(/^"|"$/g, ""));
  const first = split(lines[0]);
  const hasHeader = !/\d{6,}/.test(lines[0]);
  const headers = hasHeader ? first.map((cell) => cell.toLowerCase().replace(/[^a-z0-9_]/g, "_")) : ["number", "name"];
  const numberAt = Math.max(0, headers.findIndex((header) => ["number", "phone", "mobile", "to_number", "phone_number"].includes(header)));
  const nameAt = headers.findIndex((header) => ["name", "contact_name", "full_name", "first_name"].includes(header));

  return (hasHeader ? lines.slice(1) : lines).map((line) => {
    const cells = split(line);
    const variables: Record<string, string> = {};
    headers.forEach((header, index) => {
      if (index !== numberAt && index !== nameAt && header && cells[index]) variables[header] = cells[index];
    });
    return { number: cells[numberAt] ?? "", name: nameAt >= 0 ? cells[nameAt] ?? "" : "", variables };
  }).filter((contact) => contact.number);
}
