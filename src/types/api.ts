// Shared API domain types, mirroring the FastAPI backend contract described
// in FRONTEND_INTEGRATION.md. Kept hand-written (not generated) for now -
// swap for `openapi-typescript` output later if the backend's /openapi.json
// is reachable during a build step.

export type Role = "owner" | "admin" | "sales" | "support" | "agent";

// Roles inside one business, lowest to highest (see app/core/roles.py).
// The owner is not a stored team role: it is whoever owns the business.
export type TeamRole = "viewer" | "agent" | "manager" | "admin";
export type BusinessRole = TeamRole | "owner";

export interface TeamRoleInfo {
  value: TeamRole;
  label: string;
  summary: string;
  can: string[];
  cannot: string[];
}

export interface AuthUser {
  user_id: string;
  name: string;
  email: string;
  role: Role;
  email_verified?: boolean;
  timezone?: string;
  is_platform_admin?: boolean;
}

export interface AuthResponse extends AuthUser {
  access_token: string;
}

export interface OnboardingState {
  completed_steps: string[];
  missing_fields: string[];
  total_steps: number;
  is_complete: boolean;
}

export interface QualificationCriterion {
  key: string;
  description: string;
  points: number;
}

export interface FAQItem {
  question: string;
  answer: string;
}

export interface Business {
  id: string;
  user_id?: string;
  // Set by GET /businesses: whether the caller owns this business, and if not,
  // the role they were given in it.
  is_owner?: boolean;
  team_role?: TeamRole | null;
  name: string;
  agent_id?: string;
  description?: string;
  website?: string;
  location?: string;
  working_hours?: string;
  products_services?: string;
  pricing?: string;
  faqs?: FAQItem[];
  policies?: string;
  additional_info?: string;
  agent_name?: string;
  personality?: string;
  tone?: string;
  language?: string;
  response_style?: string;
  purpose?: string;
  custom_instructions?: string;
  qualification_criteria?: QualificationCriterion[];
  onboarding?: OnboardingState;
  follow_up_enabled?: boolean;
  follow_up_no_response_hours?: number;
  // No-reply auto-resend, distinct from follow_up_*, which only creates a
  // reminder for a human; resend actually messages the customer automatically.
  resend_enabled?: boolean;
  resend_delay_minutes?: number;
  resend_max_attempts?: number;
  resend_template_name?: string;
  [key: string]: unknown;
}

export interface Notification {
  id: string;
  user_id: string;
  type: string;
  title: string;
  body: string;
  agent_id?: string | null;
  metadata?: Record<string, unknown>;
  read: boolean;
  read_at?: string | null;
  created_at: string;
}

export interface AuditLogEntry {
  id: string;
  user_id: string;
  business_id?: string | null;
  agent_id?: string | null;
  action: string;
  summary: string;
  changes?: Record<string, unknown> | null;
  actor_role?: string | null;
  created_at: string;
}

export type ActivityFeedItem = (Notification | AuditLogEntry) & { source: "notification" | "audit_log" };

export type DocumentStatus = "processing" | "ready" | "failed";
export type DocumentSourceType = "file" | "url";

// GET /rag/documents list item - field names confirmed against
// app/api/routes/rag/documents.py (id is renamed from _id there).
export interface RagDocument {
  id: string;
  description?: string;
  status: DocumentStatus;
  source_type?: DocumentSourceType;
  filename?: string;
  url?: string;
  website_profile?: boolean;
  created_at?: string;
  [key: string]: unknown;
}

// POST /rag/documents/upload and /ingest-url return a different, minimal
// shape, NOT a full RagDocument. id field is `doc_id`, not `id`.
export interface RagUploadResult {
  success: boolean;
  doc_id: string;
  filename?: string;
  url?: string;
  num_chunks: number;
  status: "ready" | "failed";
}

export interface WhatsAppOfficialConnection {
  id: string;
  phone_number: string;
  display_name?: string;
  status: string;
  business_name?: string;
  verified_name?: string;
  agent_id?: string;
  webhook_configured?: boolean;
  connected_at?: string;
  whatsapp_business_account_id?: string;
  [key: string]: unknown;
}

export type ConversationChannel =
  | "whatsapp"
  | "whatsapp_group"
  | "instagram"
  | "messenger"
  | "widget"
  | "telegram"
  | "sms"
  | "twitter"
  | "discord"
  | string;
export type ConversationStatus = "open" | "human_active" | "resolved" | "pending" | string;

export interface ConversationCustomer {
  id: string;
  name?: string;
  phone?: string;
  /** "@username" on Instagram, Telegram, Discord and X. */
  handle?: string;
  /** Profile photo, where the channel shares one (Instagram, Messenger). */
  avatar_url?: string;
  // Only populated by endpoints that join the full Customer record
  // (business_conversations.py's /detail, hot-leads, follow-ups) - the
  // account-wide /dashboard/conversations list never includes these.
  tags?: string[];
  notes?: string | null;
}

// Field names confirmed against app/api/routes/businesses/business_conversations.py -
// this is NOT the shape FRONTEND_INTEGRATION.md implies (no customer_name/customer_phone/
// last_message_preview/last_message_at/unread_count fields exist on the backend).
// last_message is populated by the dashboard-home endpoint (dashboard_repository.py's
// get_recent_conversations) but not by the plain per-business conversation list.
export interface ConversationListItem {
  conversation_key: string;
  customer: ConversationCustomer | null;
  channel: ConversationChannel;
  status: ConversationStatus;
  lead_score: number;
  lead_status?: string;
  intent?: string;
  sentiment?: string;
  tags: string[];
  ai_enabled: boolean;
  /** Instagram/WhatsApp: false when the account's or number's own "AI replies" switch is off, which
   *  silences the AI for every chat on it whatever `ai_enabled` says. null/undefined: no such switch. */
  account_ai_enabled?: boolean | null;
  last_activity?: string;
  // Present when the list came from the account-wide /dashboard/conversations
  // endpoint (every agent, not one business), absent from the per-business list.
  agent_id?: string;
  agent_name?: string;
  last_message?: string;
  assigned_team_member?: string | null;
  /** Messenger only: where this person sits in Meta's reply windows. */
  reply_window?: {
    state: "open" | "human_agent" | "closed";
    last_inbound_at: string | null;
    standard_closes_at: string | null;
    human_closes_at: string | null;
  } | null;
}

export interface ConversationDetail extends Omit<ConversationListItem, "last_activity"> {
  summary?: string;
  last_activity?: string;
  paused_by?: string | null;
  timeline?: unknown[];
}

// Newer deployments return a stable message id for deduplication and feedback.
export interface Message {
  id: string;
  role: "user" | "assistant" | "system" | "human_agent";
  content: string;
  created_at: string | null;
  user_profile?: unknown;
  metadata?: {
    sent_by?: string;
    message_id?: string | null;
    delivery_status?: "accepted" | "sent" | "delivered" | "read" | "failed";
    delivery_errors?: unknown;
    media_type?: "image" | "video" | "audio" | "document";
    media_url?: string;
    filename?: string;
    transcript?: string;
    [key: string]: unknown;
  };
}

export type HotLeadLabel = "warm" | "hot" | "very_hot";

// Field names confirmed against app/api/routes/businesses/hot_leads.py -
// note lead_score/lead_status, NOT score/label (a prior version of this
// type had the wrong names, which meant the score ring and hot/very_hot
// styling both silently rendered as blank/default since neither field the
// UI read ever existed on the response).
export interface HotLead {
  customer_id: string;
  name?: string;
  phone?: string;
  lead_score: number;
  lead_status?: string;
  requirements?: string[];
  budget?: string;
  tags: string[];
  notes?: string | null;
  last_interaction?: string;
  last_signal?: string;
  recommended_action?: string;
  conversation?: {
    conversation_key: string;
    status: string;
    last_activity?: string;
    intent?: string;
  } | null;
  [key: string]: unknown;
}

export interface HotLeadTimelineEntry {
  signal: string;
  delta: number;
  resulting_score: number;
  timestamp: string;
}

export interface TeamMember {
  user_id: string;
  name: string;
  email: string;
  role: TeamRole;
  [key: string]: unknown;
}

// Field names confirmed against app/api/routes/businesses/follow_ups.py -
// customer is a nested object, not flat customer_id/customer_name fields.
export interface FollowUp {
  id: string;
  customer?: { id: string; name?: string; phone?: string; tags?: string[]; notes?: string | null } | null;
  suggested_message: string;
  reason?: string;
  status: "pending" | "completed" | "dismissed";
  created_at?: string;
  [key: string]: unknown;
}

export type KnowledgeGapStatus = "open" | "resolved" | "dismissed";

/** One time a question was asked and couldn't be answered. */
export interface KnowledgeGapOccurrence {
  asked_at?: string;
  channel?: string | null;
  /** The customer on that channel (phone, Instagram id, chat session...). */
  user_key?: string | null;
  conversation_key?: string | null;
  text?: string | null;
  reason_text?: string | null;
}

/** A question customers asked that the knowledge base had nothing for. */
export interface KnowledgeGap {
  id: string;
  question_text: string;
  occurrence_count: number;
  sample_conversation_keys: string[];
  status: KnowledgeGapStatus;
  created_at?: string;
  last_asked_at?: string;
  resolved_at?: string;
  /** Channels it was asked on, e.g. "whatsapp", "instagram". */
  channels: string[];
  occurrences: KnowledgeGapOccurrence[];
  last_reason?: "no_match" | "weak_match";
  last_reason_text?: string | null;
  closest_source?: string | null;
  closest_score?: number | null;
  /** The answer saved to the knowledge base when it was resolved from here. */
  answer?: string | null;
}

export type FeedbackReason =
  | "incorrect_information"
  | "wrong_tone"
  | "didnt_understand_customer"
  | "too_long"
  | "missing_information"
  | "should_have_escalated";

export interface MessageFeedback {
  message_id: string;
  rating: "up" | "down";
  reason?: FeedbackReason;
}

export interface FeedbackCounts {
  up: number;
  down: number;
  [key: string]: unknown;
}

export interface DashboardToday {
  new_conversations: number;
  active_conversations: number;
  hot_leads_count: number;
  human_required_count: number;
  ai_resolutions: number;
  ai_resolutions_note?: string;
  conversions: number;
}

export interface DashboardAttention {
  hot_leads: unknown[];
  waiting_for_human: unknown[];
  follow_ups_due: unknown[];
  open_knowledge_gaps_count: number;
}

export interface DashboardHome {
  today: DashboardToday;
  attention_required: DashboardAttention;
  recent_conversations: ConversationListItem[];
}

export interface AnalyticsOverview {
  average_response_time: number | null;
  average_response_time_note?: string;
  top_intents: Array<{ intent: string; count: number }>;
  top_intents_note?: string;
  human_takeover_rate: number | null;
  human_takeover_rate_note?: string;
  [key: string]: unknown;
}

export interface AnalyticsSales {
  revenue_generated: number | null;
  revenue_generated_note?: string;
  [key: string]: unknown;
}

export interface AnalyticsAi {
  average_response_time: number | null;
  average_response_time_note?: string;
  ai_resolution_rate: number | null;
  ai_resolution_rate_note?: string;
  knowledge_usage: { tracked: boolean; [key: string]: unknown };
  [key: string]: unknown;
}
