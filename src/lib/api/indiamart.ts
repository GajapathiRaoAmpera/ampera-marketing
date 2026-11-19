import { api } from "./client";
import type { Product } from "./products";

// ── Lead Manager ──

export interface IndiaMartLead {
  id: string;
  business_id: string;
  indiamart_lead_id: string | null;
  dedup_key: string;
  buyer_name: string | null;
  phone: string | null;
  email: string | null;
  product: string | null;
  message: string | null;
  query_time: string;
  created_at: string;
}

export interface ConnectIndiaMartResult {
  success: boolean;
  business_id: string;
  verified: boolean;
  verify_error: string | null;
}

export interface IndiaMartStatus {
  connected: boolean;
  connected_at?: string | null;
  last_pulled_at?: string | null;
  next_pull_at?: string | null;
  last_pull_error?: string | null;
  auto_pull_minutes?: number;
  storefront_url?: string | null;
}

export interface PullLeadsResult {
  pulled: number;
  saved: number;
  skipped: number;
  error?: string;
}

// ── Catalog (storefront scrape) ──

export interface IndiaMartCandidateProduct {
  row_ref: string;
  name: string;
  description: string | null;
  price: number | null;
  image_url: string | null;
}

export interface IndiaMartCatalogPreview {
  storefront_url: string;
  pages_scanned: number;
  source_character_count: number;
  candidate_products: IndiaMartCandidateProduct[];
}

export interface IndiaMartCatalogConfirmResult {
  added: number;
  updated: number;
  failed: number;
  products: Product[];
}

export interface IndiaMartCatalogRefreshResult extends IndiaMartCatalogConfirmResult {
  removed: number;
  storefront_url: string;
}

const base = (businessId: string) => `/businesses/${businessId}/indiamart`;

export const indiamartApi = {
  status: (businessId: string) => api.get<IndiaMartStatus>(`${base(businessId)}/status`),

  connect: (businessId: string, crmKey: string) =>
    api.post<ConnectIndiaMartResult>(`${base(businessId)}/connect`, { crm_key: crmKey }),

  pullLeads: (businessId: string) => api.post<PullLeadsResult>(`${base(businessId)}/pull`, {}),

  listLeads: async (businessId: string, limit = 50): Promise<IndiaMartLead[]> => {
    const res = await api.get<{ leads: IndiaMartLead[] }>(`${base(businessId)}/leads?limit=${limit}`);
    return res.leads;
  },

  disconnect: (businessId: string) => api.delete<{ success: boolean }>(`${base(businessId)}/disconnect`),

  previewCatalog: (businessId: string, storefrontUrl: string) =>
    api.post<IndiaMartCatalogPreview>(`${base(businessId)}/catalog/preview`, { storefront_url: storefrontUrl }),

  confirmCatalog: (businessId: string, storefrontUrl: string, products: IndiaMartCandidateProduct[]) =>
    api.post<IndiaMartCatalogConfirmResult>(`${base(businessId)}/catalog/confirm`, {
      storefront_url: storefrontUrl,
      products,
    }),

  listCatalog: async (businessId: string): Promise<Product[]> => {
    const res = await api.get<{ products: Product[] }>(`${base(businessId)}/catalog`);
    return res.products;
  },

  refreshCatalog: (businessId: string) =>
    api.post<IndiaMartCatalogRefreshResult>(`${base(businessId)}/catalog/refresh`, {}),
};
