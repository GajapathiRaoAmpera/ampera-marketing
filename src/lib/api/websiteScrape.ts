import { api } from "./client";
import type { Business, FAQItem } from "@/types/api";
import type { Product } from "./products";

export interface ScrapeCandidateProduct {
  name: string;
  description: string | null;
  price: number | null;
}

export interface ScrapeExtractedFields {
  name: string | null;
  description: string | null;
  website: string | null;
  location: string | null;
  working_hours: string | null;
  products_services: string | null;
  pricing: string | null;
  faqs: FAQItem[];
  policies: string | null;
  additional_info: string | null;
}

export interface ScrapePreview {
  scraped_url: string;
  extracted: ScrapeExtractedFields;
  candidate_products: ScrapeCandidateProduct[];
  pages: ScrapedPage[];
  source_content: string;
  source_character_count: number;
  field_limits: Partial<Record<keyof ScrapeExtractedFields, number>>;
}

export interface ScrapedPage {
  url: string;
  content: string;
  character_count: number;
  extraction_mode: "html" | "browser" | "pdf";
  truncated: boolean;
}

export interface StoredWebsiteContent {
  id: string;
  source_url: string;
  source_content: string;
  source_character_count: number;
  pages: Array<Omit<ScrapedPage, "content">>;
  num_chunks: number;
  status: "ready" | "failed";
  updated_at?: string;
}

export interface ScrapeConfirmResult {
  business: Business;
  products_added: Product[];
  knowledge_document?: { id: string; num_chunks: number; status: string } | null;
  warnings: Array<{ code: string; message: string }>;
}

const base = (businessId: string) => `/businesses/${businessId}/website-scrape`;

export const websiteScrapeApi = {
  preview: (businessId: string, url: string) => api.post<ScrapePreview>(`${base(businessId)}/preview`, { url }),

  sources: async (businessId: string): Promise<StoredWebsiteContent[]> => {
    const result = await api.get<{ sources: StoredWebsiteContent[] }>(`${base(businessId)}/sources`);
    return result.sources;
  },

  removeSource: (businessId: string, sourceId: string) =>
    api.delete<{ deleted: boolean }>(`${base(businessId)}/sources/${sourceId}`),

  confirm: (
    businessId: string,
    payload: {
      fields: Partial<ScrapeExtractedFields>;
      products_to_add: ScrapeCandidateProduct[];
      source_content?: string;
      source_pages?: ScrapedPage[];
      source_url?: string;
    }
  ) => api.post<ScrapeConfirmResult>(`${base(businessId)}/confirm`, payload),
};
