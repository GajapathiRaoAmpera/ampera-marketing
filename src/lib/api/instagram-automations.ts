import { api } from "./client";

export type InstagramSurface = "post" | "reel" | "story" | "live";
export type InstagramScopeType = "all" | "specific" | "next";
export type InstagramTriggerType =
  | "comment" | "live_comment" | "dm" | "story_reply" | "story_reaction"
  | "story_mention" | "account_mention" | "media_share" | "referral";
export type InstagramActionType =
  | "public_reply" | "private_reply" | "send_text" | "send_media" | "send_buttons"
  | "react" | "delay" | "route_ai" | "human_handoff" | "add_tag" | "webhook" | "stop";

export interface InstagramConnection {
  id: string;
  business_id: string;
  instagram_business_id: string;
  instagram_username: string;
  agent_id?: string | null;
  auth_mode: "instagram_login" | "facebook_page";
  health_status?: string;
  granted_scopes: string[];
  webhook_fields: string[];
  connected_at?: string;
  /** AI replies to DMs. Off for new connections until turned on. */
  ai_enabled?: boolean;
  profile_picture_url?: string | null;
  profile_name?: string | null;
  followers_count?: number | null;
  media_count?: number | null;
}

/** The connected account's live profile and AI switch. */
export interface InstagramProfile {
  connection_id: string;
  username: string;
  profile_picture_url?: string | null;
  profile_name?: string | null;
  followers_count?: number | null;
  follows_count?: number | null;
  media_count?: number | null;
  ai_enabled: boolean;
  /** Whether the platform admin includes AI replies in this account's plan. */
  ai_allowed: boolean;
  agent_id?: string | null;
  /** False when Instagram could not be reached and cached values are shown. */
  live: boolean;
}

export interface InstagramCommentModeration {
  enabled: boolean;
  phone_numbers: boolean;
  emails: boolean;
  links: boolean;
  keywords: string[];
  action: "delete" | "hide";
}

export type InstagramMediaKind = "post" | "reel" | "carousel" | "video";

export interface InstagramMediaChild {
  id: string;
  media_type?: string;
  media_url?: string;
  thumbnail_url?: string;
  preview_url?: string;
}

export interface InstagramConnectionHealth {
  status: "healthy" | "degraded" | "disconnected";
  missing_webhook_fields: string[];
  subscribed_fields: string[];
  granted_scopes: string[];
  errors: string[];
}

export interface InstagramMedia {
  id: string;
  caption?: string;
  media_type?: string;
  media_product_type?: string;
  permalink?: string;
  thumbnail_url?: string;
  media_url?: string;
  /** Resolved best-available preview (falls back to media_url server-side), prefer this for rendering. */
  preview_url?: string;
  timestamp?: string;
  comments_count?: number;
  like_count?: number;
  /** Carousel slides, in order. */
  children?: InstagramMediaChild[];
}

export interface InstagramMediaPage {
  data: InstagramMedia[];
  paging?: { cursors?: { after?: string | null }; next?: unknown };
}

export interface InstagramButtonAction {
  id: string;
  title: string;
  url?: string;
}

export interface InstagramAction {
  type: InstagramActionType;
  text?: string;
  /** Alternative wordings; one is picked at random for each send. */
  variations?: string[];
  media_url?: string;
  media_type?: "image" | "video" | "audio";
  buttons?: InstagramButtonAction[];
  emoji?: string;
  delay_seconds?: number;
  tag?: string;
}

export interface InstagramAutomation {
  id: string;
  connection_id: string;
  business_id: string;
  name: string;
  status: "draft" | "active" | "paused" | "error";
  priority: number;
  version: number;
  trigger: {
    type: InstagramTriggerType;
    keywords: string[];
    match_mode: "any" | "all" | "exact" | "contains";
    exclusions: string[];
    branches: Array<{ keywords: string[]; action_overrides: InstagramAction[] }>;
    referral_sources: string[];
    referral_ids: string[];
  };
  scope: {
    type: InstagramScopeType;
    media_ids: string[];
    media_types: string[];
    surfaces: InstagramSurface[];
    bound_media_id?: string | null;
  };
  conditions: {
    follower_state: "any" | "follows" | "does_not_follow";
    contact_state: "any" | "new" | "existing";
    require_open_window: boolean;
  };
  actions: InstagramAction[];
  cooldown_seconds: number;
  created_at?: string;
}

export type CreateInstagramAutomation = Omit<InstagramAutomation, "id" | "business_id" | "status" | "version" | "created_at">;
export type UpdateInstagramAutomation = Partial<CreateInstagramAutomation>;

export interface InstagramAutomationAnalytics {
  automation_id: string;
  total_executions: number;
  succeeded: number;
  failed: number;
  unique_commenters: number;
  [key: string]: unknown;
}

export interface InstagramExecution {
  id: string;
  business_id: string;
  connection_id: string;
  automation_id: string | null;
  event_key: string;
  event_type: string;
  status: "succeeded" | "failed" | "partial" | "unmatched" | string;
  /** Only present on "unmatched" executions: why no automation fired. */
  unmatched_reason?: string;
  /** Instagram-scoped id of whoever commented/messaged. */
  subject_id?: string | null;
  subject_username?: string | null;
  /** The comment or DM text that triggered (or failed to trigger) this. */
  text?: string | null;
  comment_id?: string | null;
  media_id?: string | null;
  action_results?: Array<Record<string, unknown>>;
  created_at?: string;
}

export interface InstagramInsightValue {
  value?: number;
  end_time?: string;
}

export interface InstagramInsightMetric {
  name: string;
  period: string;
  title?: string;
  description?: string;
  values: InstagramInsightValue[];
  total_value?: { value?: number; breakdowns?: Array<{ dimension_keys: string[]; results: Array<{ dimension_values: string[]; value: number }> }> };
}

export interface InstagramInsightsResponse {
  data: InstagramInsightMetric[];
}

export type InstagramInsightPeriod = "day" | "week" | "days_28";
export type InstagramInsightMetricType = "total_value" | "time_series";

export interface InstagramMediaContainer {
  id: string;
}

export interface InstagramContainerStatus {
  id: string;
  status_code: "IN_PROGRESS" | "FINISHED" | "ERROR" | "EXPIRED" | "PUBLISHED" | string;
  status?: string;
}

export interface InstagramPublishResult {
  id: string;
  permalink?: string | null;
}

export interface InstagramUploadResult {
  url: string;
  content_type: string;
  is_video: boolean;
}

export type InstagramPostType = "feed" | "reel" | "story";
export type InstagramPostStatus = "draft" | "scheduled" | "publishing" | "published" | "failed";

export interface InstagramPostMedia {
  url: string;
  is_video: boolean;
  alt_text?: string;
}

/** What the composer edits. `action` decides whether it is saved, queued or sent. */
export interface InstagramPostInput {
  connection_id: string;
  post_type: InstagramPostType;
  media: InstagramPostMedia[];
  caption: string;
  share_to_feed: boolean;
  cover_url: string | null;
  user_tags: string[];
  collaborators: string[];
  first_comment: string;
  comments_disabled: boolean;
  automation_id: string | null;
  cross_post_telegram: boolean;
  cross_post_facebook?: boolean;
  scheduled_at: string | null;
  action: "draft" | "schedule" | "publish";
}

export interface InstagramPost extends Omit<InstagramPostInput, "action"> {
  id: string;
  status: InstagramPostStatus;
  published_at?: string | null;
  created_at?: string | null;
  updated_at?: string | null;
  media_id?: string | null;
  permalink?: string | null;
  error?: string | null;
  warnings?: string[];
  like_count?: number | null;
  comments_count?: number | null;
}

export interface InstagramPublishOverview {
  limit: { used: number | null; total: number | null } | null;
  telegram_connected: boolean;
  facebook_connected?: boolean;
}

export interface InstagramBestTimes {
  hours: Array<{ hour_utc: number; posts: number; avg_engagement: number }>;
  sample_size: number;
}

export interface InstagramSnippet {
  id: string;
  kind: "caption" | "hashtags";
  name: string;
  text: string;
}

export interface InstagramLibraryItem {
  id: string;
  url: string;
  is_video: boolean;
  created_at?: string | null;
}

/** Per-account sending limits the account holder can tune, each bounded by a hard cap. */
export interface InstagramSafetyLimits {
  private_replies_per_hour: number;
  private_replies_per_day: number;
  public_replies_per_hour: number;
  public_replies_per_day: number;
  dms_per_hour: number;
  dms_per_day: number;
  posts_per_day: number;
  min_gap_seconds: number;
  max_gap_seconds: number;
  person_cooldown_hours: number;
  warmup_enabled: boolean;
  sending_paused: boolean;
}

export type InstagramSafetyNumberKey = Exclude<keyof InstagramSafetyLimits, "warmup_enabled" | "sending_paused">;

export interface InstagramSafetyOverview {
  limits: InstagramSafetyLimits;
  /** Limits enforced right now: the saved ones, tightened while warming up. */
  effective: InstagramSafetyLimits;
  defaults: InstagramSafetyLimits;
  /** The most each setting can be: Instagram's limit, lowered by any cap the platform admin set. */
  hard_caps: Record<InstagramSafetyNumberKey, number>;
  floors: Record<InstagramSafetyNumberKey, number>;
  /** Settings the platform admin has capped for this account. */
  admin_limited: InstagramSafetyNumberKey[];
  /** Most sends per minute, by kind. */
  per_minute: { private_reply: number; public_reply: number; dm: number };
  usage: {
    private_reply: { hour: number; day: number };
    public_reply: { hour: number; day: number };
    dm: { hour: number; day: number };
    posts: { day: number };
  };
  state: {
    paused_until: string | null;
    pause_reason: "meta_throttled" | "meta_policy_block" | "usage_high" | string | null;
    slowed_until: string | null;
    warmup_active: boolean;
    warmup_ends_at: string | null;
    /** Automated replies waiting for the limits to allow them. */
    queued: number;
    /** Comments that arrived while sending was paused and are still unanswered. */
    queued_by_pause: number;
  };
}

export interface InstagramResumeResult extends InstagramSafetyOverview {
  resumed: { was_waiting: number; replying_to: number; skipped: number };
}

/** What became of the comments an Instagram account received. */
export interface InstagramCommentMetrics {
  period_days: number;
  /** Comment automations currently switched on for this account. */
  automations_enabled: number;
  comments_received: number;
  replied: number;
  /** Not answered yet: still being processed, or waiting for the sending limits. */
  pending: number;
  waiting_for_limits: number;
  /** No automation matched the comment (keywords, post or conditions). */
  not_matched: number;
  /** Deliberately not answered: same-person cooldown or the account's own comment. */
  skipped: number;
  /** Matched, but no reply could be sent. */
  missed: number;
  /** A rule matched and tried to answer. */
  triggered?: number;
  /** Deleted or hidden by the comment rules. */
  removed?: number;
  /** Stopped by the plan (cap reached, or automations not included): not a fault. */
  blocked_by_plan: number;
  missed_breakdown: {
    failed: number;
    /** Waited past Instagram's 7-day limit for private replies. */
    expired: number;
    no_connection: number;
    stuck_unprocessed: number;
  };
  /** replied / comments_received, or null when nothing was received. */
  reply_rate: number | null;
}

export interface InstagramAccountCommentMetrics extends InstagramCommentMetrics {
  connection_id: string;
  /** Automated sends waiting in the queue right now. */
  queued_sends: number;
}

export interface InstagramExecutionFilters {
  unmatchedOnly?: boolean;
  limit?: number;
  connectionId?: string;
  /** ISO times: events at or after `since` and before `until`. */
  since?: string;
  until?: string;
  /** Oldest created_at already shown, to load the next (older) batch. */
  before?: string;
  statuses?: string[];
  eventTypes?: string[];
  /** Matches the comment/message text or the username. */
  search?: string;
}

const base = (businessId: string) => `/businesses/${businessId}/instagram`;
const publishBase = (businessId: string) => `${base(businessId)}/publish`;

export const instagramAutomationsApi = {
  connections: async (businessId: string) =>
    (await api.get<{ connections: InstagramConnection[] }>(`${base(businessId)}/connections`)).connections,
  health: (businessId: string, connectionId: string) =>
    api.get<InstagramConnectionHealth>(`${base(businessId)}/connections/${connectionId}/health`),
  safety: (businessId: string, connectionId: string) =>
    api.get<InstagramSafetyOverview>(`${base(businessId)}/connections/${connectionId}/safety`),
  commentMetrics: (businessId: string, connectionId: string, days = 7) =>
    api.get<InstagramAccountCommentMetrics>(`${base(businessId)}/connections/${connectionId}/metrics?days=${days}`),
  pauseSending: (businessId: string, connectionId: string) =>
    api.post<InstagramSafetyOverview>(`${base(businessId)}/connections/${connectionId}/pause`, {}),
  /** Start sending again, and answer (or skip) the comments that arrived while paused. */
  resumeSending: (businessId: string, connectionId: string, replyToUnanswered: boolean) =>
    api.post<InstagramResumeResult>(`${base(businessId)}/connections/${connectionId}/resume`, {
      reply_to_unanswered: replyToUnanswered,
    }),
  updateSafety: (businessId: string, connectionId: string, limits: Partial<InstagramSafetyLimits>) =>
    api.put<InstagramSafetyOverview>(`${base(businessId)}/connections/${connectionId}/safety`, limits),
  disconnect: (businessId: string, connectionId: string) =>
    api.delete<{ success: boolean; manual_removal_required: boolean; instagram_removal_url: string | null }>(
      `${base(businessId)}/connections/${connectionId}`
    ),
  subscribe: (businessId: string, connectionId: string) =>
    api.post(`${base(businessId)}/connections/${connectionId}/subscribe`, {}),
  media: async (
    businessId: string,
    connectionId: string,
    options?: { kind?: InstagramMediaKind; after?: string | null; limit?: number }
  ) => {
    const params = new URLSearchParams({ connection_id: connectionId, limit: String(options?.limit ?? 24) });
    if (options?.kind) params.set("media_type", options.kind);
    if (options?.after) params.set("after", options.after);
    return api.get<InstagramMediaPage>(`${base(businessId)}/media?${params}`);
  },
  mediaItem: (businessId: string, connectionId: string, mediaId: string) =>
    api.get<InstagramMedia>(`${base(businessId)}/media/${encodeURIComponent(mediaId)}?connection_id=${encodeURIComponent(connectionId)}`),
  mediaMetrics: (businessId: string, connectionId: string, mediaIds: string[], days = 90) =>
    api.get<{ period_days: number; media: Record<string, InstagramCommentMetrics> }>(
      `${base(businessId)}/connections/${connectionId}/media-metrics?days=${days}&media_ids=${encodeURIComponent(mediaIds.join(","))}`
    ),
  profile: (businessId: string, connectionId: string) =>
    api.get<InstagramProfile>(`${base(businessId)}/connections/${connectionId}/profile`),
  setAi: (businessId: string, connectionId: string, enabled: boolean) =>
    api.put<{ connection_id: string; ai_enabled: boolean }>(`${base(businessId)}/connections/${connectionId}/ai`, { enabled }),
  moderation: (businessId: string, connectionId: string) =>
    api.get<InstagramCommentModeration>(`${base(businessId)}/connections/${connectionId}/moderation`),
  updateModeration: (businessId: string, connectionId: string, settings: InstagramCommentModeration) =>
    api.put<InstagramCommentModeration>(`${base(businessId)}/connections/${connectionId}/moderation`, settings),
  stories: (businessId: string, connectionId: string) =>
    api.get<{ data: InstagramMedia[] }>(`${base(businessId)}/stories?connection_id=${encodeURIComponent(connectionId)}&limit=100`),
  list: async (businessId: string, connectionId?: string) => {
    const query = connectionId ? `?connection_id=${encodeURIComponent(connectionId)}` : "";
    return (await api.get<{ automations: InstagramAutomation[] }>(`${base(businessId)}/automations${query}`)).automations;
  },
  create: (businessId: string, input: CreateInstagramAutomation) =>
    api.post<{ automation: InstagramAutomation; validation: { valid: boolean; errors: string[]; warnings: string[] } }>(`${base(businessId)}/automations`, input),
  get: (businessId: string, automationId: string) =>
    api.get<{ automation: InstagramAutomation; validation: { valid: boolean; errors: string[]; warnings: string[] } }>(`${base(businessId)}/automations/${automationId}`),
  update: (businessId: string, automationId: string, input: UpdateInstagramAutomation) =>
    api.patch<{ automation: InstagramAutomation; validation: { valid: boolean; errors: string[]; warnings: string[] } }>(`${base(businessId)}/automations/${automationId}`, input),
  activate: (businessId: string, automationId: string) =>
    api.post(`${base(businessId)}/automations/${automationId}/activate`, {}),
  pause: (businessId: string, automationId: string) =>
    api.post(`${base(businessId)}/automations/${automationId}/pause`, {}),
  duplicate: (businessId: string, automationId: string) =>
    api.post(`${base(businessId)}/automations/${automationId}/duplicate`, {}),
  versions: (businessId: string, automationId: string) =>
    api.get<{ versions: Array<Record<string, unknown>> }>(`${base(businessId)}/automations/${automationId}/versions`),
  rollback: (businessId: string, automationId: string, version: number) =>
    api.post(`${base(businessId)}/automations/${automationId}/rollback/${version}`, {}),
  remove: (businessId: string, automationId: string) =>
    api.delete(`${base(businessId)}/automations/${automationId}`),
  simulate: (businessId: string, automationId: string, sample: Record<string, unknown>) =>
    api.post(`${base(businessId)}/automations/${automationId}/simulate`, sample),
  executions: (businessId: string, automationId?: string, options?: InstagramExecutionFilters) => {
    const params = new URLSearchParams();
    if (automationId) params.set("automation_id", automationId);
    if (options?.unmatchedOnly) params.set("unmatched_only", "true");
    if (options?.limit) params.set("limit", String(options.limit));
    if (options?.connectionId) params.set("connection_id", options.connectionId);
    if (options?.since) params.set("since", options.since);
    if (options?.until) params.set("until", options.until);
    if (options?.before) params.set("before", options.before);
    if (options?.statuses?.length) params.set("status", options.statuses.join(","));
    if (options?.eventTypes?.length) params.set("event_type", options.eventTypes.join(","));
    if (options?.search?.trim()) params.set("search", options.search.trim());
    const query = params.toString() ? `?${params}` : "";
    return api.get<{ executions: InstagramExecution[] }>(`${base(businessId)}/executions${query}`);
  },
  analytics: (businessId: string, automationId: string) =>
    api.get<InstagramAutomationAnalytics>(`${base(businessId)}/automations/${automationId}/analytics`),
  entryLink: (businessId: string, connectionId: string, referral?: string) =>
    api.post<{ url: string; qr_data_uri?: string; website_button: { href: string; label: string } }>(
      `${base(businessId)}/entry-link?connection_id=${encodeURIComponent(connectionId)}`,
      { referral: referral || undefined, include_qr: true }
    ),

  // ── Insights ──
  insights: (
    businessId: string,
    connectionId: string,
    options?: { period?: InstagramInsightPeriod; metricType?: InstagramInsightMetricType; metrics?: string; since?: string; until?: string; breakdown?: string }
  ) => {
    const params = new URLSearchParams({ connection_id: connectionId });
    params.set("period", options?.period ?? "day");
    params.set("metric_type", options?.metricType ?? "total_value");
    if (options?.metrics) params.set("metrics", options.metrics);
    if (options?.since) params.set("since", options.since);
    if (options?.until) params.set("until", options.until);
    if (options?.breakdown) params.set("breakdown", options.breakdown);
    return api.get<InstagramInsightsResponse>(`${base(businessId)}/insights?${params}`);
  },
  mediaInsights: (businessId: string, mediaId: string, connectionId: string, metrics?: string) => {
    const params = new URLSearchParams({ connection_id: connectionId });
    if (metrics) params.set("metrics", metrics);
    return api.get<InstagramInsightsResponse>(`${base(businessId)}/media/${mediaId}/insights?${params}`);
  },

  // ── Publishing ──
  /** `fit: "free"` skips the feed aspect-ratio check (Stories, Reel covers). `save: false` keeps it out of the library. */
  uploadMedia: (businessId: string, file: File, options?: { fit?: "feed" | "free"; save?: boolean }) => {
    const form = new FormData();
    form.append("file", file);
    const params = new URLSearchParams({ fit: options?.fit ?? "feed", save: String(options?.save ?? true) });
    return api.post<InstagramUploadResult>(`${base(businessId)}/media/upload?${params}`, form, { isFormData: true });
  },

  // ── Composer posts (drafts, scheduled, published) ──
  posts: async (businessId: string) =>
    (await api.get<{ posts: InstagramPost[] }>(`${publishBase(businessId)}/posts`)).posts,
  getPost: (businessId: string, postId: string) =>
    api.get<InstagramPost>(`${publishBase(businessId)}/posts/${postId}`),
  createPost: (businessId: string, input: InstagramPostInput) =>
    api.post<InstagramPost>(`${publishBase(businessId)}/posts`, input),
  updatePost: (businessId: string, postId: string, input: InstagramPostInput) =>
    api.patch<InstagramPost>(`${publishBase(businessId)}/posts/${postId}`, input),
  publishPostNow: (businessId: string, postId: string) =>
    api.post<InstagramPost>(`${publishBase(businessId)}/posts/${postId}/publish-now`, {}),
  deletePost: (businessId: string, postId: string) =>
    api.delete(`${publishBase(businessId)}/posts/${postId}`),
  publishOverview: (businessId: string, connectionId: string) =>
    api.get<InstagramPublishOverview>(`${publishBase(businessId)}/overview?connection_id=${encodeURIComponent(connectionId)}`),
  bestTimes: (businessId: string, connectionId: string) =>
    api.get<InstagramBestTimes>(`${publishBase(businessId)}/best-times?connection_id=${encodeURIComponent(connectionId)}`),
  aiCaptions: async (businessId: string, brief: string, tone: string) =>
    (await api.post<{ captions: string[] }>(`${publishBase(businessId)}/ai/caption`, { brief, tone })).captions,
  aiHashtags: async (businessId: string, caption: string) =>
    (await api.post<{ hashtags: string[] }>(`${publishBase(businessId)}/ai/hashtags`, { caption })).hashtags,
  snippets: async (businessId: string) =>
    (await api.get<{ snippets: InstagramSnippet[] }>(`${publishBase(businessId)}/snippets`)).snippets,
  createSnippet: (businessId: string, input: Omit<InstagramSnippet, "id">) =>
    api.post<InstagramSnippet>(`${publishBase(businessId)}/snippets`, input),
  deleteSnippet: (businessId: string, snippetId: string) =>
    api.delete(`${publishBase(businessId)}/snippets/${snippetId}`),
  library: async (businessId: string) =>
    (await api.get<{ items: InstagramLibraryItem[] }>(`${publishBase(businessId)}/library`)).items,
  deleteLibraryItem: (businessId: string, itemId: string) =>
    api.delete(`${publishBase(businessId)}/library/${itemId}`),
  publishNow: (businessId: string, connectionId: string, input: { mediaUrl: string; caption: string; isReel?: boolean }) =>
    api.post<InstagramPublishResult>(`${base(businessId)}/media/publish?connection_id=${encodeURIComponent(connectionId)}`, {
      media_url: input.mediaUrl,
      caption: input.caption,
      is_reel: Boolean(input.isReel),
    }),
  createContainer: (businessId: string, connectionId: string, input: { mediaUrl: string; caption: string; isReel?: boolean }) =>
    api.post<InstagramMediaContainer>(`${base(businessId)}/media/container?connection_id=${encodeURIComponent(connectionId)}`, {
      media_url: input.mediaUrl,
      caption: input.caption,
      is_reel: Boolean(input.isReel),
    }),
  containerStatus: (businessId: string, connectionId: string, creationId: string) =>
    api.get<InstagramContainerStatus>(`${base(businessId)}/media/container/${creationId}/status?connection_id=${encodeURIComponent(connectionId)}`),
  publishContainer: (businessId: string, connectionId: string, creationId: string) =>
    api.post<InstagramPublishResult>(`${base(businessId)}/media/container/${creationId}/publish?connection_id=${encodeURIComponent(connectionId)}`, {}),
};
