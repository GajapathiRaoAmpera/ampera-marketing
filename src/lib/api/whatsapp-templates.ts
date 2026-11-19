import { api } from "./client";

// Mirrors app/models/schemas/whatsapp_templates.py component shape exactly -
// this is a raw passthrough to Meta's message_templates API, so the field
// names/casing here (HEADER/BODY/FOOTER/BUTTONS, QUICK_REPLY/URL/PHONE_NUMBER)
// must match Meta's API precisely, not just look similar.

export type TemplateCategory = "UTILITY" | "MARKETING" | "AUTHENTICATION";
export type TemplateStatus = "PENDING" | "APPROVED" | "REJECTED" | "PAUSED" | "DISABLED" | string;

export interface TemplateButton {
  type: "QUICK_REPLY" | "URL" | "PHONE_NUMBER" | "FLOW" | "MPM" | "CATALOG" | "OTP";
  text: string;
  url?: string;
  phone_number?: string;
  flow_name?: string;
  flow_id?: string;
  flow_action?: "navigate" | "data_exchange";
  navigate_screen?: string;
  /** OTP buttons only - Meta auto-fills the message with the code either way. */
  otp_type?: "COPY_CODE" | "ONE_TAP";
}

export interface CarouselCard {
  components: TemplateComponent[];
}

export interface TemplateComponent {
  type: "HEADER" | "BODY" | "FOOTER" | "BUTTONS" | "CAROUSEL";
  format?: "TEXT" | "IMAGE" | "VIDEO" | "DOCUMENT";
  text?: string;
  buttons?: TemplateButton[];
  cards?: CarouselCard[];
  example?: {
    header_text?: string[];
    header_handle?: string[];
    body_text?: string[][];
  };
  /** BODY component, AUTHENTICATION templates only - adds Meta's fixed security-warning line. */
  add_security_recommendation?: boolean;
  /** FOOTER component, AUTHENTICATION templates only - shows "This code expires in N minutes." */
  code_expiration_minutes?: number;
}

export interface MetaWhatsAppFlow {
  id: string;
  name: string;
  status: string;
  categories?: string[];
  validation_errors?: unknown[];
  health_status?: string;
}

export interface WhatsAppTemplate {
  id?: string;
  name: string;
  category: TemplateCategory;
  language: string;
  status: TemplateStatus;
  components: TemplateComponent[];
  quality_score?: unknown;
  rejected_reason?: string | null;
  created_at?: string;
  updated_at?: string;
}

export interface CreateTemplateInput {
  name: string;
  category: TemplateCategory;
  language: string;
  components: TemplateComponent[];
  allow_category_change?: boolean;
}

interface CreateTemplateResponse {
  success: boolean;
  template_id?: string;
  status?: string;
  category?: string;
  message?: string;
  error?: string;
  error_code?: number;
}

interface LocalTemplatesResponse {
  success: boolean;
  templates: WhatsAppTemplate[];
  count: number;
}

interface TemplateStatsResponse {
  total: number;
  approved: number;
  pending: number;
  rejected: number;
  by_category: Record<string, number>;
}

interface GetTemplateResponse {
  success: boolean;
  template?: WhatsAppTemplate | WhatsAppTemplate[];
  count?: number;
  error?: string;
}

interface DeleteTemplateResponse {
  success: boolean;
  message?: string;
  error?: string;
}

interface SyncTemplatesResponse {
  success: boolean;
  synced_count: number;
  templates: WhatsAppTemplate[];
  error?: string;
  /** "token_expired" when Meta rejected the stored access token (code 190) -
   * this token type has no silent refresh, so the fix is reconnecting via
   * the WhatsApp connect page, not retrying. */
  error_reason?: string;
}

// The backend mounts this router at /api/agents on top of its own internal
// /whatsapp/templates prefix (app/main.py: whatsapp_templates_router gets
// prefix="/api/agents", same convention as whatsapp_onboarding_router) - so
// the real path is /api/agents/whatsapp/templates/..., not /whatsapp/templates/...
const BASE = "/api/agents/whatsapp/templates";
const withBusiness = (path: string, businessId?: string) => {
  if (!businessId) return path;
  return `${path}${path.includes("?") ? "&" : "?"}business_id=${encodeURIComponent(businessId)}`;
};

export const whatsappTemplatesApi = {
  uploadMedia: (file: File, businessId?: string) => {
    const form = new FormData();
    form.append("file", file, file.name);
    return api.post<{ handle: string; content_type: string; filename?: string }>(withBusiness(`${BASE}/media-handle`, businessId), form, { isFormData: true });
  },
  flows: async (businessId?: string): Promise<MetaWhatsAppFlow[]> => {
    const response = await api.get<{ flows: MetaWhatsAppFlow[] }>(withBusiness(`${BASE}/flows`, businessId));
    return response.flows;
  },
  create: (input: CreateTemplateInput, businessId?: string) =>
    api.post<CreateTemplateResponse>(withBusiness(`${BASE}/create`, businessId), {
      ...input,
      allow_category_change: input.allow_category_change ?? true,
    }),

  listLocal: async (params?: { status?: string; limit?: number; skip?: number; businessId?: string }): Promise<WhatsAppTemplate[]> => {
    const search = new URLSearchParams();
    if (params?.status) search.set("status", params.status);
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.skip) search.set("skip", String(params.skip));
    if (params?.businessId) search.set("business_id", params.businessId);
    const qs = search.toString();
    const res = await api.get<LocalTemplatesResponse>(`${BASE}/local${qs ? `?${qs}` : ""}`);
    return res.templates;
  },

  stats: (businessId?: string) => api.get<TemplateStatsResponse>(withBusiness(`${BASE}/stats`, businessId)),

  refreshStatus: (name: string, language = "en_US", businessId?: string) =>
    api.get<GetTemplateResponse>(withBusiness(`${BASE}/refresh-status/${encodeURIComponent(name)}?language=${encodeURIComponent(language)}`, businessId)),

  delete: (name: string, businessId?: string) => api.delete<DeleteTemplateResponse>(withBusiness(`${BASE}/delete/${encodeURIComponent(name)}`, businessId)),

  sync: (businessId?: string) => api.post<SyncTemplatesResponse>(withBusiness(`${BASE}/sync`, businessId)),
};
