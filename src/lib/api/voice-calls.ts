import { api } from "./client";

export type VoiceCapability = "calls" | "voicemail" | "transfer" | "whisper" | "texts" | "recording" | "realtime" | "live_transfer";

export interface VoiceStatus {
  connected: boolean;
  provider?: string;
  provider_name?: string;
  capabilities?: VoiceCapability[];
  /** The two URLs to set on the phone number in the provider's console. */
  webhooks?: { answer: string; status: string };
  from_number?: string;
  agent_id?: string | null;
  connected_at?: string | null;
  streaming_enabled?: boolean;
  /** "gemini_live" | "open" (our free engine) | "sarvam" | "auto" */
  engine?: string;
  max_concurrent_calls?: number;
  record_calls?: boolean;
}

export interface CallSummary {
  outcome: string;
  sentiment: "positive" | "neutral" | "negative";
  key_points: string[];
  next_steps: string[];
}

export interface CallSession {
  id: string;
  agent_id: string;
  call_sid: string;
  from_number: string;
  to_number: string;
  direction: "inbound" | "outbound" | "preview";
  status: string;
  turn_history: { role: "caller" | "agent"; text: string; at: string }[];
  language_switches?: { at: string; from_lang: string; to_lang: string }[];
  extracted_data?: Record<string, unknown>;
  summary?: CallSummary;
  disposition?: string | null;
  resolved?: boolean;
  qa_score?: number | null;
  qa_notes?: string[];
  unanswered_questions?: string[];
  caller_name?: string;
  contact_name?: string | null;
  call_context?: string | null;
  attempt?: number;
  answered_by?: string;
  after_hours?: boolean;
  transferred?: boolean;
  transfer_failed?: boolean;
  human_requested?: boolean;
  returning_caller?: boolean;
  callback_scheduled?: boolean;
  callback_requested_at?: string | null;
  retry_at?: string | null;
  voicemail_left?: boolean;
  opted_out?: boolean;
  lead_label?: string | null;
  starred?: boolean;
  notes?: string;
  tags?: string[];
  metrics?: { duration_seconds: number | null; caller_turns: number; agent_turns: number; agent_talk_ratio: number | null };
  analysis_status?: string;
  recording_url?: string | null;
  recording_duration_seconds?: number | null;
  started_at: string;
  ended_at?: string | null;
}

interface CallsListResponse {
  calls: CallSession[];
  total: number;
}

export const voiceCallsApi = {
  getCall: (callId: string) => api.get<CallSession>(`/channels/voice/calls/${encodeURIComponent(callId)}`),
  connect: (provider: string, fromNumber: string, credentials: Record<string, string>) =>
    api.post<{ success: boolean; from_number: string; message: string }>("/channels/voice/connect", {
      provider,
      from_number: fromNumber,
      credentials,
    }),

  status: () => api.get<VoiceStatus>("/channels/voice/status"),

  disconnect: () => api.delete("/channels/voice/disconnect"),

  linkAgent: (agentId: string) => api.post("/channels/voice/link-agent", { agent_id: agentId }),

  /** Takes the agent off the number; the number itself stays connected. */
  unlinkAgent: () => api.delete("/channels/voice/link-agent"),

  outboundCall: (toNumber: string, openingMessage?: string) =>
    api.post<{ success: boolean; call_sid: string; to_number: string }>("/channels/voice/outbound", {
      to_number: toNumber,
      opening_message: openingMessage,
    }),

  listCallHistory: async (agentId: string): Promise<CallSession[]> => {
    const res = await api.get<CallsListResponse>(`/channels/voice/calls?agent_id=${encodeURIComponent(agentId)}`);
    return res.calls;
  },

  updateStreamingSettings: (payload: { streaming_enabled: boolean; engine?: string; max_concurrent_calls?: number; record_calls?: boolean }) =>
    api.post<{ success: boolean }>("/channels/voice/streaming-settings", payload),
};
