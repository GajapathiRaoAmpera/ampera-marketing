import { api } from "./client";

export const WEBHOOK_EVENTS = ["message.received", "message.sent", "lead.scored", "sentiment.negative", "ai.paused", "call.completed"] as const;

export interface OutboundWebhook {
  id: string; label: string; url: string; events: string[]; active: boolean;
  secret_header?: string | null; secret_value?: string | null; created_at?: string;
}

export interface WebhookLog {
  id: string; event?: string; event_id?: string; status_code?: number | null; success: boolean;
  attempt: number; duration_ms?: number; response_preview?: string; error?: string; created_at?: string;
}

const BASE = "/webhooks/outbound";
const scoped = (path: string, businessId: string) => `${path}${path.includes("?") ? "&" : "?"}business_id=${encodeURIComponent(businessId)}`;

export const outboundWebhooksApi = {
  list: async (businessId: string) => (await api.get<{ webhooks: OutboundWebhook[] }>(scoped(BASE, businessId))).webhooks,
  create: (businessId: string, input: { label: string; url: string; events: string[] }) =>
    api.post<{ success: boolean; webhook: OutboundWebhook; signing_secret: string }>(scoped(BASE, businessId), input),
  update: (businessId: string, id: string, input: Partial<Pick<OutboundWebhook, "label" | "url" | "events" | "active">>) =>
    api.patch<{ success: boolean }>(scoped(`${BASE}/${id}`, businessId), input),
  delete: (businessId: string, id: string) => api.delete<{ success: boolean }>(scoped(`${BASE}/${id}`, businessId)),
  test: (businessId: string, id: string) => api.post<{ success: boolean; status_code?: number; response_body?: string; error?: string }>(scoped(`${BASE}/${id}/test`, businessId), {}),
  logs: async (businessId: string, id: string) => (await api.get<{ logs: WebhookLog[] }>(scoped(`${BASE}/${id}/logs`, businessId))).logs,
  retry: (businessId: string, id: string, logId: string) => api.post<{ success: boolean; event_id: string }>(scoped(`${BASE}/${id}/logs/${logId}/retry`, businessId), {}),
  health: (businessId: string) => api.get<{ webhooks: Record<string, { attempts: number; successes: number; failures: number; last_delivery_at?: string }>; total: number }>(scoped(`${BASE}/health`, businessId)),
};
