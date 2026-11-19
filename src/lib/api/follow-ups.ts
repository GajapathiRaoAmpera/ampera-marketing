import { api } from "./client";
import type { FollowUp } from "@/types/api";

interface FollowUpsListResponse {
  follow_ups: FollowUp[];
  total: number;
}

interface FollowUpResponse {
  success: boolean;
  follow_up: FollowUp;
}

export const followUpsApi = {
  list: async (businessId: string): Promise<FollowUp[]> => {
    const res = await api.get<FollowUpsListResponse>(`/businesses/${businessId}/follow-ups`);
    return res.follow_ups;
  },

  updateStatus: async (
    businessId: string,
    followUpId: string,
    status: "completed" | "dismissed"
  ): Promise<FollowUp> => {
    const res = await api.patch<FollowUpResponse>(`/businesses/${businessId}/follow-ups/${followUpId}`, { status });
    return res.follow_up;
  },
};
