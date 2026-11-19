import { api } from "./client";

export type BuiltinToolKey = "rag_lookup" | "get_price" | "check_stock" | "book_appointment";

export interface WebhookImplementation {
  kind: "custom_webhook";
  webhook_url: string;
  webhook_secret?: string | null;
}

export interface BusinessTool {
  id: string;
  business_id: string;
  tool_key: string;
  enabled: boolean;
  display_name: string;
  description?: string | null;
  parameters_schema?: Record<string, unknown>;
  implementation?: { kind: "builtin" | "custom_webhook"; webhook_url?: string; webhook_secret?: string | null };
  created_at?: string;
  updated_at?: string;
}

export interface ToolEnablePayload {
  tool_key: string;
  enabled: boolean;
  display_name?: string;
  description?: string;
  parameters_schema?: Record<string, unknown>;
  implementation?: WebhookImplementation;
}

const base = (businessId: string) => `/businesses/${businessId}/voice-studio/tools`;

export const voiceToolsApi = {
  list: async (businessId: string) => {
    const result = await api.get<{ tools: BusinessTool[] }>(base(businessId));
    return result.tools;
  },

  upsert: (businessId: string, payload: ToolEnablePayload) =>
    api.put<{ tool: BusinessTool }>(base(businessId), payload),

  remove: (businessId: string, toolKey: string) =>
    api.delete<{ success: boolean }>(`${base(businessId)}/${toolKey}`),
};
