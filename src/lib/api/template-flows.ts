import { api } from "./client";

// Mirrors app/api/routes/triggers/template_flows.py's request/response shapes.
// A "greeting" is just a flow with trigger_type="first_message" and one step:
// it fires once per contact on their first-ever inbound message. Both this and
// multi-step flows completely bypass the AI/LLM/RAG pipeline.

export type FlowChannel = "whatsapp" | "instagram";
export type FlowTriggerType = "first_message" | "keyword" | "manual";

export interface FlowButton {
  id: string;
  title: string;
  next_step_id?: string | null;
}

export interface FlowStep {
  step_id: string;
  message: string;
  buttons: FlowButton[];
  /** Reaching this step hands the customer over to the team. */
  handoff?: boolean;
  /** A photo sent with the message (https URL). */
  image_url?: string | null;
  /** One link button under the message; the menu ends here. */
  link_url?: string | null;
  link_label?: string | null;
  /** The menu ends and the AI agent answers what the customer types next. */
  ask_ai?: boolean;
}

/** A button whose next_step_id is this opens the live product list (WhatsApp only). */
export const SHOP_STEP_ID = "shop";

export interface TemplateFlow {
  id: string;
  user_id: string;
  agent_id: string;
  channel: FlowChannel;
  name: string;
  trigger_type: FlowTriggerType;
  active: boolean;
  entry_step_id: string;
  steps: FlowStep[];
  /** Words that start (or restart) this flow. */
  keywords?: string[];
  created_at?: string;
  updated_at?: string;
}

export interface CreateFlowInput {
  agent_id: string;
  channel: FlowChannel;
  name: string;
  trigger_type: FlowTriggerType;
  entry_step_id: string;
  steps: FlowStep[];
  active?: boolean;
  keywords?: string[];
}

export interface UpdateFlowInput {
  name?: string;
  entry_step_id?: string;
  steps?: FlowStep[];
  keywords?: string[];
  trigger_type?: FlowTriggerType;
}

interface CreateFlowResponse {
  success: boolean;
  flow: TemplateFlow;
}

interface ListFlowsResponse {
  flows: TemplateFlow[];
  total: number;
}

interface GetFlowResponse {
  flow: TemplateFlow;
}

interface MutateFlowResponse {
  success: boolean;
  flow_id: string;
  active?: boolean;
}

const BASE = "/flows";

export const templateFlowsApi = {
  create: (input: CreateFlowInput) => api.post<CreateFlowResponse>(BASE, input),

  list: async (agentId?: string): Promise<TemplateFlow[]> => {
    const qs = agentId ? `?agent_id=${encodeURIComponent(agentId)}` : "";
    const res = await api.get<ListFlowsResponse>(`${BASE}${qs}`);
    return res.flows;
  },

  get: async (flowId: string): Promise<TemplateFlow> => {
    const res = await api.get<GetFlowResponse>(`${BASE}/${flowId}`);
    return res.flow;
  },

  update: (flowId: string, input: UpdateFlowInput) => api.put<MutateFlowResponse>(`${BASE}/${flowId}`, input),

  activate: (flowId: string) => api.patch<MutateFlowResponse>(`${BASE}/${flowId}/activate`),

  deactivate: (flowId: string) => api.patch<MutateFlowResponse>(`${BASE}/${flowId}/deactivate`),

  delete: (flowId: string) => api.delete<MutateFlowResponse>(`${BASE}/${flowId}`),
};
