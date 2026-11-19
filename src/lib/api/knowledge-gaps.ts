import { api } from "./client";
import type { KnowledgeGap, KnowledgeGapStatus } from "@/types/api";

export interface KnowledgeGapsListResponse {
  knowledge_gaps: KnowledgeGap[];
  total: number;
  counts?: Record<KnowledgeGapStatus, number>;
}

interface KnowledgeGapResponse {
  success: boolean;
  knowledge_gap: KnowledgeGap;
}

export const knowledgeGapsApi = {
  list: async (businessId: string, status: KnowledgeGapStatus = "open"): Promise<KnowledgeGap[]> => {
    const res = await api.get<KnowledgeGapsListResponse>(`/businesses/${businessId}/knowledge-gaps?status=${status}`);
    return res.knowledge_gaps;
  },

  /** The gaps with one status plus how many there are of each. */
  page: (businessId: string, status: KnowledgeGapStatus) =>
    api.get<KnowledgeGapsListResponse>(`/businesses/${businessId}/knowledge-gaps?status=${status}`),

  /** Save the answer into the knowledge base and resolve the gap. */
  answer: async (businessId: string, gapId: string, answer: string, question?: string): Promise<KnowledgeGap> => {
    const res = await api.post<KnowledgeGapResponse>(`/businesses/${businessId}/knowledge-gaps/${gapId}/answer`, {
      answer,
      question: question || undefined,
    });
    return res.knowledge_gap;
  },

  updateStatus: async (
    businessId: string,
    gapId: string,
    status: KnowledgeGapStatus
  ): Promise<KnowledgeGap> => {
    const res = await api.patch<KnowledgeGapResponse>(`/businesses/${businessId}/knowledge-gaps/${gapId}`, {
      status,
    });
    return res.knowledge_gap;
  },
};
