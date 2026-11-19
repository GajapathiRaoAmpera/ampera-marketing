import { api } from "./client";
import type { HotLead, HotLeadTimelineEntry } from "@/types/api";

interface HotLeadsListResponse {
  hot_leads: HotLead[];
  total: number;
}

interface CustomerTagsResponse {
  tags: string[];
}

interface CustomersByTagResponse {
  customers: HotLead[];
  total: number;
}

export const hotLeadsApi = {
  list: async (businessId: string, minLabel?: "hot" | "very_hot"): Promise<HotLead[]> => {
    const res = await api.get<HotLeadsListResponse>(
      `/businesses/${businessId}/hot-leads${minLabel ? `?min_label=${minLabel}` : ""}`
    );
    return res.hot_leads;
  },

  timeline: (businessId: string, customerId: string) =>
    api.get<{ customer_id: string; conversation_key?: string; timeline: HotLeadTimelineEntry[]; total: number }>(
      `/businesses/${businessId}/hot-leads/${customerId}/timeline`
    ),

  // Every tag any customer of this business has been tagged with (user-added
  // tags, not AI-scored labels) - powers the Tagged tab's filter dropdown.
  listTags: async (businessId: string): Promise<string[]> => {
    const res = await api.get<CustomerTagsResponse>(`/businesses/${businessId}/customer-tags`);
    return res.tags;
  },

  // Customers carrying a specific tag - independent of AI lead score, so a
  // "warm" or unscored customer the user tagged VIP still shows up here
  // even though /hot-leads (min_label=hot|very_hot) would never include them.
  listByTag: async (businessId: string, tag: string): Promise<HotLead[]> => {
    const res = await api.get<CustomersByTagResponse>(
      `/businesses/${businessId}/customers-by-tag?tag=${encodeURIComponent(tag)}`
    );
    return res.customers;
  },
};
