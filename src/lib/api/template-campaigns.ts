import { api } from "./client";

// POST /template-campaigns is disabled (see app/api/routes/broadcasts/template_campaigns.py)
// - superseded by WhatsApp Studio Campaigns, which enforces contact opt-in.
// listAll/get stay so any pre-existing campaign records remain viewable.

export type CampaignStatus = "pending" | "running" | "completed" | "failed" | string;

export interface TemplateCampaign {
  id: string;
  name: string;
  template_name: string;
  language_code: string;
  contact_list_id: string;
  contact_list_name: string;
  recipient_count: number;
  status: CampaignStatus;
  total_sent: number;
  total_failed: number;
  errors: Array<{ contact?: string; error: string }>;
  created_at: string;
  started_at?: string;
  completed_at?: string;
}

interface ListCampaignsResponse {
  campaigns: TemplateCampaign[];
  total: number;
}

export const templateCampaignsApi = {
  listAll: async (): Promise<TemplateCampaign[]> => {
    const res = await api.get<ListCampaignsResponse>("/template-campaigns");
    return res.campaigns;
  },

  get: (campaignId: string) => api.get<TemplateCampaign>(`/template-campaigns/${campaignId}`),
};
