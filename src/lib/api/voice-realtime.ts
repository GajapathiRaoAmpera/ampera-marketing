import { api } from "./client";

/** How the agent speaks on real-time calls. Mirrors app/services/voice/interruption.py. */
export type Sensitivity = "low" | "balanced" | "high";
export type Patience = "quick" | "balanced" | "patient";

export interface InterruptionSettings {
  enabled: boolean;
  sensitivity: Sensitivity;
  patience: Patience;
  min_words: number;
  protect_greeting: boolean;
  idle_prompt_seconds: number;
  idle_max_prompts: number;
}

export type SpeakingStyle = "warm" | "professional" | "casual";
export type RealtimeEngine = "gemini_live" | "open" | "sarvam" | "auto";

/** What a business wants for callers from one country. Blank fields follow the region's default. */
export interface RegionVoiceOverride {
  language?: string | null;
  gemini_voice?: string | null;
  sarvam_speaker?: string | null;
  open_voice?: string | null;
  engine?: string | null;
}

/** One way the agent can sound in an A/B test. Anything left blank follows the agent's normal settings. */
export interface ExperimentVariant {
  id: string;
  label?: string;
  weight: number;
  gemini_voice?: string | null;
  open_voice?: string | null;
  sarvam_speaker?: string | null;
  speaking_style?: SpeakingStyle | null;
  greeting?: string | null;
  interruption_preset?: string | null;
  engine?: string | null;
}

export interface ExperimentConfig {
  enabled: boolean;
  name: string;
  variants: ExperimentVariant[];
}

/** The real-time part of an agent's call settings (the rest lives on the calling settings page). */
export interface Department {
  name: string;
  description: string;
  /** A person to hand the call to. Blank = the agent takes on the role itself. */
  phone: string;
  /** For a role desk: how to behave and what to know. */
  instructions: string;
}

export interface RealtimeSettings {
  voice_routing: "agent" | "region";
  voice_gender: "female" | "male";
  local_language_greeting: boolean;
  live_voice: string;
  live_speaker: string;
  open_voice: string;
  region_voices: Record<string, RegionVoiceOverride>;
  interruption: InterruptionSettings;
  speaking_style: SpeakingStyle;
  /** Keys a caller can press: {"1": "Sales"}. 0 always asks for a person. */
  dtmf_menu: Record<string, string>;
  live_alerts: boolean;
  allow_texts: boolean;
  allow_payment_links: boolean;
  engine_fallback: boolean;
  experiment: ExperimentConfig;
  /** Things every call must do, scored pass/fail per call. */
  qa_checklist: string[];
  departments: Department[];
  /** A cloned voice made with its owner's consent; blank = the normal voices. */
  cloned_voice_id: string;
}

export const REALTIME_DEFAULTS: RealtimeSettings = {
  voice_routing: "agent",
  voice_gender: "female",
  local_language_greeting: false,
  live_voice: "",
  live_speaker: "",
  open_voice: "",
  region_voices: {},
  interruption: {
    enabled: true,
    sensitivity: "balanced",
    patience: "balanced",
    min_words: 0,
    protect_greeting: true,
    idle_prompt_seconds: 8,
    idle_max_prompts: 2,
  },
  speaking_style: "warm",
  dtmf_menu: {},
  live_alerts: true,
  allow_texts: true,
  allow_payment_links: false,
  engine_fallback: true,
  experiment: { enabled: false, name: "", variants: [] },
  qa_checklist: [],
  departments: [],
  cloned_voice_id: "",
};

export interface RegionInfo {
  code: string;
  name: string;
  dial_codes: string[];
  language: string;
  english: string;
  gemini_voices: { female: string; male: string };
}

export interface VoiceOption {
  id: string;
  gender: "female" | "male";
  character?: string;
  language?: string;
}

export interface RegionCatalog {
  regions: RegionInfo[];
  gemini_voices: VoiceOption[];
  sarvam_speakers: VoiceOption[];
  open_voices: VoiceOption[];
  gemini_languages: string[];
  sarvam_languages: string[];
  engines: RealtimeEngine[];
  interruption_presets: Record<string, InterruptionSettings>;
  speaking_styles: Record<SpeakingStyle, string>;
}

/** The voice a call to or from one number would get. */
export interface RoutedVoice {
  region: string;
  language: string;
  gemini_voice: string;
  sarvam_language: string;
  sarvam_speaker: string;
  open_voice: string;
  open_language: string;
  engine: string;
  source: "agent" | "region" | "override";
}

export interface ExperimentVariantResult {
  id: string;
  label: string;
  calls: number;
  connected: number;
  good_outcome_rate: number | null;
  human_request_rate: number | null;
  avg_duration_seconds: number | null;
  avg_qa_score: number | null;
}

export interface ExperimentResults {
  active: boolean;
  name?: string;
  variants?: ExperimentVariantResult[];
  verdict?: { status: "collecting" | "inconclusive" | "winner"; message: string; winner: string | null; confidence: number };
  min_calls_per_variant?: number;
}

/** Estimated spend (rupees): minutes times per-minute rates, not invoices. */
export interface CostReport {
  currency: string;
  estimated: boolean;
  month: { spent: number; cap: number; percent: number | null; level: "none" | "ok" | "alert" | "limit"; capped: boolean };
  total: number;
  by_day: { day: string; engine: string; total: number; calls: number; minutes: number }[];
  by_engine: { engine: string; total: number; calls: number; minutes: number }[];
  rates_per_minute: Record<string, number>;
}

export interface QaReport {
  items: { item: string; met: number; missed: number; applied: number; pass_rate: number | null }[];
  calls: number;
  average_score: number | null;
}

export interface Voicemail {
  id: string;
  number: string;
  name: string;
  transcript: string;
  summary: string;
  urgency: "urgent" | "normal";
  department: string;
  status: "new" | "handled";
  note?: string;
  created_at: string;
}

export interface ContactProfile {
  id?: string;
  number: string;
  name?: string;
  language?: string;
  facts?: string[];
  notes?: string;
  tags?: string[];
  calls?: number;
  last_outcome?: string;
  last_seen?: string;
}

export interface VoiceClone {
  id: string;
  label: string;
  owner_name: string;
  relation: "self" | "authorized";
  status: "pending" | "active" | "revoked";
  uses: number;
  created_at: string;
  /** Only while pending: the one-time sentence the voice's owner reads aloud. */
  challenge?: string;
  challenge_expires?: string;
  attempts_left?: number;
}

export const voiceRealtimeApi = {
  voicemails: (status: "new" | "handled" | "all" = "new") =>
    api.get<{ voicemails: Voicemail[]; new: number }>(`/channels/voice/voicemails?status=${status}`),
  updateVoicemail: (id: string, status: "new" | "handled", note?: string) =>
    api.patch(`/channels/voice/voicemails/${encodeURIComponent(id)}`, { status, ...(note !== undefined ? { note } : {}) }),
  deleteVoicemail: (id: string) => api.delete(`/channels/voice/voicemails/${encodeURIComponent(id)}`),

  contacts: (q = "") => api.get<{ contacts: ContactProfile[] }>(`/channels/voice/contacts?q=${encodeURIComponent(q)}`),
  saveContact: (number: string, patch: Partial<Pick<ContactProfile, "name" | "language" | "facts" | "notes" | "tags">>) =>
    api.put<ContactProfile>(`/channels/voice/contacts/profile?number=${encodeURIComponent(number)}`, patch),
  forgetContact: (number: string) => api.delete(`/channels/voice/contacts/profile?number=${encodeURIComponent(number)}`),

  clones: () => api.get<{ clones: VoiceClone[]; available: boolean }>("/channels/voice/clones"),
  startClone: (body: { label: string; owner_name: string; relation: "self" | "authorized"; authorization_note: string; attest: boolean }) =>
    api.post<VoiceClone>("/channels/voice/clones/start", body),
  submitClone: (id: string, consent: File, samples: File[]) => {
    const form = new FormData();
    form.append("consent", consent);
    samples.forEach(sample => form.append("samples", sample));
    return api.post<VoiceClone>(`/channels/voice/clones/${encodeURIComponent(id)}/submit`, form, { isFormData: true });
  },
  revokeClone: (id: string) => api.delete<{ success: boolean; provider_deleted: boolean }>(`/channels/voice/clones/${encodeURIComponent(id)}`),

  costs: (days = 30) => api.get<CostReport>(`/channels/voice/costs?days=${days}`),

  qa: (agentId: string, days = 30) => api.get<QaReport>(`/channels/voice/qa/${encodeURIComponent(agentId)}?days=${days}`),

  catalog: () => api.get<RegionCatalog>("/channels/voice/regions"),

  /** Runs the same routing a live call uses, against the agent's saved settings. */
  previewRouting: (agentId: string, number: string) =>
    api.get<RoutedVoice>(`/channels/voice/agents/${encodeURIComponent(agentId)}/voice-routing?number=${encodeURIComponent(number)}`),

  /** Ends the AI's part of a live call and rings a person. Blank number = the team number from Rules. */
  takeover: (callId: string, number?: string) =>
    api.post<{ success: boolean; number: string }>(`/channels/voice/calls/${encodeURIComponent(callId)}/takeover`, number ? { number } : {}),

  /** Short-lived permission to hear a live call in the browser. */
  listenToken: (callId: string) =>
    api.post<{ url: string; token: string; expires_in: number }>(`/channels/voice/calls/${encodeURIComponent(callId)}/listen-token`),

  experiment: (agentId: string) => api.get<ExperimentResults>(`/channels/voice/experiments/${encodeURIComponent(agentId)}`),
};
