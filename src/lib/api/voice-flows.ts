import { api } from "./client";

export type CallFlowNodeType =
  | "start" | "greeting" | "qualify" | "pitch" | "objection_handler"
  | "collect_info" | "book_appointment" | "transfer_human" | "condition"
  | "closing" | "end";

export interface CallFlowNode {
  id: string;
  type: CallFlowNodeType;
  x: number;
  y: number;
  label?: string | null;
  config: Record<string, unknown>;
}

export interface CallFlowEdge {
  id: string;
  source: string;
  target: string;
  source_handle: string;
}

export type ExtractionFieldType = "text" | "number" | "date" | "phone" | "email";
export interface ExtractionField {
  key: string;
  label: string;
  type: ExtractionFieldType;
  required: boolean;
}

export interface CallFlow {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  default_language: string;
  graph: { nodes: CallFlowNode[]; edges: CallFlowEdge[] };
  extraction_schema: ExtractionField[];
  status: "draft" | "published";
  active: boolean;
  draft_revision: number;
  published_version?: number | null;
  updated_at?: string;
}

export interface CallFlowValidation {
  valid: boolean;
  errors: { code: string; message: string }[];
}

export interface CallFlowSimulationTrace {
  node_id: string;
  type: CallFlowNodeType;
  label?: string | null;
}

const base = (businessId: string) => `/businesses/${businessId}/voice-studio/flows`;

export const voiceFlowsApi = {
  flows: (businessId: string) =>
    api.get<{ flows: Omit<CallFlow, "graph" | "extraction_schema">[] }>(base(businessId)),

  flow: async (businessId: string, flowId: string) => {
    const result = await api.get<{ flow: CallFlow }>(`${base(businessId)}/${flowId}`);
    return result.flow;
  },

  createFlow: (
    businessId: string,
    flow: Pick<CallFlow, "name" | "description" | "default_language" | "graph" | "extraction_schema">
  ) => api.post<{ flow: CallFlow; validation: CallFlowValidation }>(base(businessId), flow),

  updateFlow: (
    businessId: string,
    flowId: string,
    flow: Partial<Pick<CallFlow, "name" | "description" | "default_language" | "graph" | "extraction_schema">>
  ) => api.patch<{ flow: CallFlow; validation: CallFlowValidation }>(`${base(businessId)}/${flowId}`, flow),

  validateFlow: (businessId: string, flowId: string) =>
    api.post<CallFlowValidation>(`${base(businessId)}/${flowId}/validate`, {}),

  simulateFlow: (businessId: string, flowId: string) =>
    api.post<{ completed: boolean; trace: CallFlowSimulationTrace[]; stopped_reason?: string }>(
      `${base(businessId)}/${flowId}/simulate`, { max_steps: 20 }
    ),

  activateFlow: (businessId: string, flowId: string) =>
    api.post<{ success: boolean; version: number; flow: CallFlow }>(`${base(businessId)}/${flowId}/activate`, {}),

  deactivateFlow: (businessId: string, flowId: string) =>
    api.post<{ success: boolean; flow: CallFlow }>(`${base(businessId)}/${flowId}/deactivate`, {}),

  deleteFlow: (businessId: string, flowId: string) =>
    api.delete<{ success: boolean }>(`${base(businessId)}/${flowId}`),
};
