import { api } from "./client";

export interface AgentChatResponse {
  reply: string;
  is_human?: boolean;
  [key: string]: unknown;
}

export interface AgentConfigOverride {
  agent_name?: string;
  personality?: string;
  tone?: string;
  language?: string;
  response_style?: string;
  purpose?: string;
  custom_instructions?: string;
}

export type WidgetLeadField = "name" | "email" | "phone";

/** Behaviour of the website widget beyond its look, all optional and off by default. */
export interface WidgetBehaviour {
  widget_lead_form: { enabled: boolean; title: string; fields: WidgetLeadField[]; required: boolean };
  widget_quick_replies: string[];
  widget_proactive: { enabled: boolean; delay_seconds: number; message: string };
  widget_allowed_domains: string[];
  widget_away: { enabled: boolean; timezone: string; start: string; end: string; days: number[]; message: string };
}

export interface Agent extends Partial<WidgetBehaviour> {
  id: string;
  name: string;
  status: string;
  system_prompt?: string;
  widget_greeting?: string;
  widget_color?: string;
  widget_position?: string;
  widget_template?: string;
  widget_theme?: string;
  widget_launcher_label?: string;
  widget_subtitle?: string;
  [key: string]: unknown;
}

interface ListAgentsResponse {
  agents: Agent[];
  total: number;
}

export const agentApi = {
  testChat: (agentId: string, message: string, sessionId?: string, configOverride?: AgentConfigOverride) =>
    api.post<AgentChatResponse>(`/agents/${agentId}/chat`, {
      message,
      session_id: sessionId,
      config_override: configOverride,
    }),

  // is_human=true role-plays a manual takeover - the message is appended as
  // the assistant's reply directly, bypassing RAG/LLM entirely.
  sendManualReply: (agentId: string, message: string, sessionId?: string) =>
    api.post<AgentChatResponse>(`/agents/${agentId}/chat`, { message, session_id: sessionId, is_human: true }),

  clearTestHistory: (agentId: string, sessionId: string) =>
    api.delete<void>(`/agents/${agentId}/chat/history?session_id=${encodeURIComponent(sessionId)}`),

  get: (agentId: string) => api.get<Agent>(`/agents/${agentId}`),

  list: async (): Promise<Agent[]> => {
    const res = await api.get<ListAgentsResponse>("/agents");
    return res.agents;
  },

  setStatus: (agentId: string, status: "running" | "paused") =>
    api.patch<{ success: boolean }>(`/agents/${agentId}`, { status }),

  updateWidget: (
    agentId: string,
    input: {
      widget_greeting?: string;
      widget_color?: string;
      widget_position?: string;
      widget_template?: string;
      widget_theme?: string;
      widget_launcher_label?: string;
      widget_subtitle?: string;
    } & Partial<WidgetBehaviour>
  ) => api.patch<{ success: boolean }>(`/agents/${agentId}`, input),
};
