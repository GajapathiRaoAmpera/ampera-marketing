import { api } from "./client";
import { encodeConversationKey } from "@/lib/utils/conversation-key";
import type {
  ConversationCustomer,
  ConversationDetail,
  ConversationListItem,
  FeedbackCounts,
  Message,
  MessageFeedback,
} from "@/types/api";

// Every list/nested-mutation endpoint on this backend wraps its payload in a
// top-level key (confirmed against the actual route source, NOT the
// integration guide, which is wrong on several of these): never bare
// arrays/objects. Each function below unwraps to the shape the UI wants.

interface ConversationsListResponse {
  conversations: ConversationListItem[];
  total: number;
}

// Raw shape of GET /dashboard/conversations - the account-wide inbox source.
// Field names differ from the per-business endpoint (last_at vs last_activity,
// lead_label vs lead_status, no customer/status/tags/summary) since it reads
// straight off message history rather than the Business/Customer/Conversation model.
interface AccountWideConversation {
  conversation_key: string;
  agent_id: string;
  agent_name: string;
  channel: string;
  user_key: string;
  display_user_key?: string;
  display_name?: string | null;
  handle?: string | null;
  avatar_url?: string | null;
  reply_window?: ConversationListItem["reply_window"];
  last_message: string;
  last_role: string | null;
  last_at: string | null;
  message_count: number;
  ai_enabled: boolean;
  account_ai_enabled?: boolean | null;
  status: string;
  assigned_team_member?: string | null;
  lead_label: string | null;
  lead_score: number | null;
  lead_reason: string | null;
  sentiment: string | null;
  sentiment_score: number | null;
  language: string | null;
}

interface AccountWideListResponse {
  conversations: AccountWideConversation[];
  total: number;
  page: number;
  page_size: number;
  total_pages: number;
  has_next: boolean;
  has_previous: boolean;
}

interface MessagesResponse {
  conversation_key: string;
  agent_id: string;
  channel: string;
  user_key: string;
  ai_enabled: boolean;
  paused_by: string | null;
  paused_at: string | null;
  messages: Message[];
  total: number;
  has_more: boolean;
  oldest_cursor: string | null;
  latest_cursor: string | null;
}

export interface ConversationPage {
  conversations: ConversationListItem[];
  total: number;
  page: number;
  pageSize: number;
  totalPages: number;
  hasNext: boolean;
  hasPrevious: boolean;
}

export interface MessagePage {
  messages: Message[];
  total: number;
  hasMore: boolean;
  oldestCursor: string | null;
  latestCursor: string | null;
}

interface UpdateStatusResponse {
  success: boolean;
  conversation_key: string;
  conversation: ConversationDetail;
}

interface UpdateControlResponse {
  success: boolean;
  conversation_key: string;
  ai_enabled: boolean;
  message: string;
  notes?: string;
}

interface SendManualReplyResponse {
  success: boolean;
  conversation_key: string;
  message: string;
  message_id?: string | null;
  delivery_status?: string;
}

interface SendManualMediaReplyResponse {
  success: boolean;
  conversation_key: string;
  media_type: "image" | "video" | "audio" | "document";
  media_url: string;
  message_id?: string | null;
}

interface FeedbackListResponse {
  feedback: MessageFeedback[];
  total: number;
}

export interface QuickReply {
  id: string;
  label: string;
  body: string;
}

export const conversationsApi = {
  list: async (
    businessId: string,
    params?: { status?: string; channel?: string }
  ): Promise<ConversationListItem[]> => {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.channel) search.set("channel", params.channel);
    const qs = search.toString();
    const res = await api.get<ConversationsListResponse>(
      `/businesses/${businessId}/conversations${qs ? `?${qs}` : ""}`
    );
    return res.conversations;
  },

  // Account-wide inbox: every agent this user owns, not just the one selected
  // in the sidebar. Reads straight from message history, so it's unaffected by
  // whether a channel's webhook also writes to the Business/Customer/Conversation
  // model - this is the source of truth for "did we actually get this message".
  listAccountWide: async (params?: {
    channel?: string;
    agentId?: string;
    pausedOnly?: boolean;
    status?: string;
    page?: number;
    pageSize?: number;
  }): Promise<ConversationPage> => {
    const search = new URLSearchParams();
    if (params?.channel) search.set("channel", params.channel);
    if (params?.agentId) search.set("agent_id", params.agentId);
    if (params?.pausedOnly) search.set("paused_only", "true");
    if (params?.status) search.set("status", params.status);
    search.set("page", String(params?.page ?? 1));
    search.set("page_size", String(params?.pageSize ?? 20));
    const qs = search.toString();
    const res = await api.get<AccountWideListResponse>(`/dashboard/conversations${qs ? `?${qs}` : ""}`);
    const conversations = res.conversations.map((c) => ({
      conversation_key: c.conversation_key,
      customer: {
        id: c.user_key,
        name: c.display_name ?? undefined,
        phone: c.display_user_key ?? c.user_key,
        handle: c.handle ?? undefined,
        avatar_url: c.avatar_url ?? undefined,
      },
      reply_window: c.reply_window ?? null,
      channel: c.channel,
      status: c.status,
      lead_score: c.lead_score ?? 0,
      lead_status: c.lead_label ?? undefined,
      intent: undefined,
      sentiment: c.sentiment ?? undefined,
      tags: [],
      ai_enabled: c.ai_enabled,
      account_ai_enabled: c.account_ai_enabled ?? null,
      last_activity: c.last_at ?? undefined,
      agent_id: c.agent_id,
      agent_name: c.agent_name,
      last_message: c.last_message,
      assigned_team_member: c.assigned_team_member,
    }));
    return {
      conversations,
      total: res.total,
      page: res.page,
      pageSize: res.page_size,
      totalPages: res.total_pages,
      hasNext: res.has_next,
      hasPrevious: res.has_previous,
    };
  },

  detail: (businessId: string, conversationKey: string) =>
    api.get<ConversationDetail>(
      `/businesses/${businessId}/conversations/${encodeConversationKey(conversationKey)}/detail`
    ),

  // Customer.tags / Customer.notes - the person-level fields that follow a
  // customer across every conversation/channel, distinct from updateStatus's
  // `tags` param (that's a separate, per-conversation Conversation.tags array).
  updateCustomer: async (
    businessId: string,
    conversationKey: string,
    input: { tags?: string[]; notes?: string }
  ): Promise<ConversationCustomer | null> => {
    const res = await api.patch<{ success: boolean; customer: ConversationCustomer | null }>(
      `/businesses/${businessId}/conversations/${encodeConversationKey(conversationKey)}/customer`,
      input
    );
    return res.customer;
  },

  // Message IDs and created_at + ID cursors keep pagination and polling stable.
  messages: async (
    conversationKey: string,
    params?: { before?: string; after?: string; limit?: number }
  ): Promise<MessagePage> => {
    const search = new URLSearchParams();
    if (params?.before) search.set("before", params.before);
    if (params?.after) search.set("after", params.after);
    search.set("limit", String(params?.limit ?? 50));
    const res = await api.get<MessagesResponse>(
      `/dashboard/conversations/${encodeConversationKey(conversationKey)}/messages?${search.toString()}`
    );
    return {
      messages: res.messages,
      total: res.total,
      hasMore: res.has_more,
      oldestCursor: res.oldest_cursor,
      latestCursor: res.latest_cursor,
    };
  },

  updateStatus: async (
    businessId: string,
    conversationKey: string,
    input: { status?: string; tags?: string[]; assigned_team_member?: string }
  ): Promise<ConversationDetail> => {
    const res = await api.patch<UpdateStatusResponse>(
      `/businesses/${businessId}/conversations/${encodeConversationKey(conversationKey)}/status`,
      input
    );
    return res.conversation;
  },

  // This endpoint does NOT return a conversation object - just a flat
  // acknowledgement. Callers should re-fetch the conversation list/detail
  // afterward if they need the updated ai_enabled reflected in the UI.
  updateControl: (conversationKey: string, input: { ai_enabled?: boolean; notes?: string }) =>
    api.patch<UpdateControlResponse>(
      `/dashboard/conversations/${encodeConversationKey(conversationKey)}/control`,
      input
    ),

  // Sends a human-typed reply to the real customer on WhatsApp. Requires AI
  // to already be paused for this conversation (backend enforces this).
  sendManualReply: (conversationKey: string, message: string) =>
    api.post<SendManualReplyResponse>(
      `/dashboard/conversations/${encodeConversationKey(conversationKey)}/reply`,
      { message }
    ),

  /** WhatsApp, after the 24-hour window: send an approved template. */
  sendTemplateReply: (conversationKey: string, input: { template_name: string; language: string; parameters: string[] }) =>
    api.post<SendManualReplyResponse>(`/dashboard/conversations/${encodeConversationKey(conversationKey)}/template-reply`, input),

  sendManualMediaReply: (
    conversationKey: string,
    file: File,
    mediaType: "image" | "video" | "audio" | "document",
    caption = ""
  ) => {
    const form = new FormData();
    form.append("media_type", mediaType);
    form.append("caption", caption);
    form.append("file", file, file.name);
    return api.post<SendManualMediaReplyResponse>(
      `/dashboard/conversations/${encodeConversationKey(conversationKey)}/media-reply`,
      form,
      { isFormData: true }
    );
  },

  listQuickReplies: async (businessId: string): Promise<QuickReply[]> => {
    const response = await api.get<{ quick_replies: QuickReply[] }>(
      `/businesses/${businessId}/conversations/quick-replies`
    );
    return response.quick_replies;
  },

  saveQuickReply: async (businessId: string, label: string, body: string): Promise<QuickReply> => {
    const response = await api.post<{ success: boolean; quick_reply: QuickReply }>(
      `/businesses/${businessId}/conversations/quick-replies`,
      { label, body }
    );
    return response.quick_reply;
  },

  deleteQuickReply: (businessId: string, quickReplyId: string) =>
    api.delete<void>(`/businesses/${businessId}/conversations/quick-replies/${quickReplyId}`),

  submitFeedback: (businessId: string, conversationKey: string, input: MessageFeedback) =>
    api.post<{ success: boolean; feedback: unknown }>(
      `/businesses/${businessId}/conversations/${encodeConversationKey(conversationKey)}/feedback`,
      input
    ),

  getFeedback: async (businessId: string, conversationKey: string): Promise<MessageFeedback[]> => {
    const res = await api.get<FeedbackListResponse>(
      `/businesses/${businessId}/conversations/${encodeConversationKey(conversationKey)}/feedback`
    );
    return res.feedback;
  },

  listNegativeFeedback: async (businessId: string): Promise<MessageFeedback[]> => {
    const res = await api.get<FeedbackListResponse>(`/businesses/${businessId}/feedback?rating=down`);
    return res.feedback;
  },

  feedbackCounts: (businessId: string) => api.get<FeedbackCounts>(`/businesses/${businessId}/feedback/counts`),
};
