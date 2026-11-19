import { api } from "./client";

export interface WhatsAppStudioLimits {
  messages_per_month: number | null;
  whatsapp_accounts: number | null;
  team_seats: number | null;
  contacts: number | null;
  widget_sites: number | null;
}

export interface WhatsAppStudioOverview {
  plan_id: string;
  limits: WhatsAppStudioLimits;
  usage: {
    period: string;
    used: number;
    limit: number | null;
    remaining: number | null;
    plan_id: string;
  };
  counts: {
    contacts: number;
    opted_in_contacts: number;
    segments: number;
    team_seats: number;
    whatsapp_accounts: number;
  };
  readiness: {
    official_connection: boolean;
    connection_status: "ready" | "not_connected" | "reconnect_required" | "provider_unavailable";
    secure_inbound_webhook: boolean;
    approved_templates: number;
    payments_configured: boolean;
    receipt_template_configured: boolean;
  };
}

export interface WhatsAppStudioContact {
  id: string;
  business_id: string;
  phone: string;
  name?: string | null;
  email?: string | null;
  tags: string[];
  custom_fields: Record<string, string>;
  lead_status: string;
  whatsapp_opt_in: boolean;
  opt_in_source?: string | null;
  /** The click-to-WhatsApp ad this person came from, if any. */
  ad_source?: string;
  source?: string;
  updated_at?: string;
  last_interaction?: string | null;
}

export interface WhatsAppStudioSegment {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  rules: {
    tags_any: string[];
    lead_statuses: string[];
    sources: string[];
    whatsapp_opt_in: boolean | null;
    interacted_within_days: number | null;
  };
  contact_count: number;
}

export type StudioNodeType =
  | "start" | "text" | "image" | "audio" | "video" | "file" | "location"
  | "user_input" | "form" | "appointment" | "buttons" | "template" | "ai_reply"
  | "condition" | "delay" | "http_request" | "human_handoff" | "end";

export interface StudioFlowNode {
  id: string;
  type: StudioNodeType;
  x: number;
  y: number;
  label?: string | null;
  config: Record<string, unknown>;
}

export interface StudioFlowEdge {
  id: string;
  source: string;
  target: string;
  source_handle: string;
}

export interface StudioFlow {
  id: string;
  business_id: string;
  name: string;
  description?: string | null;
  trigger_type: "first_message" | "keyword" | "intent";
  trigger_config: Record<string, unknown>;
  graph: { nodes: StudioFlowNode[]; edges: StudioFlowEdge[] };
  status: "draft" | "published";
  draft_revision: number;
  published_version?: number | null;
  updated_at?: string;
  active_sessions?: number;
}

export interface StudioFlowValidation {
  valid: boolean;
  errors: { code: string; message: string }[];
}

export interface StudioMetaFlow {
  id: string;
  name: string;
  status: string;
  categories?: string[];
  validation_errors?: { error?: string; error_type?: string; message?: string }[];
}

export type StudioMetaFormFieldType = "text" | "email" | "phone" | "textarea" | "date" | "dropdown";
export interface StudioMetaFormField {
  key: string;
  label: string;
  type: StudioMetaFormFieldType;
  required: boolean;
  options: string[];
}

/** One customer's answers to a WhatsApp Form, captured permanently when they submit. */
export interface StudioFormSubmission {
  id: string;
  business_id: string;
  flow_id: string;
  node_id: string;
  node_label?: string | null;
  meta_flow_id?: string | null;
  contact_phone: string;
  answers: Record<string, unknown>;
  created_at: string;
}

// "name" | "phone" | "email" are built-in contact fields; any other string is a
// custom field key (e.g. "location") looked up on the contact's custom_fields.
export interface StudioCampaignStep {
  name: string;
  template_name: string;
  language_code: string;
  delay_minutes: number;
  parameters: string[];
  header_media_url?: string | null;
}

export interface StudioApprovedTemplate {
  id?: string;
  name: string;
  language: string;
  status: string;
  components?: Array<{
    type: string;
    format?: string;
    text?: string;
    buttons?: Array<{ type: string; url?: string }>;
  }>;
}

export interface StudioCampaign {
  id: string;
  name: string;
  mode: "broadcast" | "drip";
  segment_id: string;
  steps: StudioCampaignStep[];
  status: "draft" | "scheduled" | "active" | "paused" | "completed" | "completed_with_errors";
  scheduled_at: string;
  sent_count: number;
  audience?: { total: number; scheduled: number; completed: number; failed: number; converted: number; delivered: number; read: number };
}

export interface StudioProduct {
  id: string; sku: string; name: string; description?: string | null;
  price: string; price_minor: number; currency: string; inventory: number;
  reserved_inventory: number; image_url?: string | null; active: boolean;
  needs_review?: boolean; meta_product_id?: string; meta_catalog_id?: string;
}

export interface StudioCatalogConnection {
  id: string; catalog_id: string; catalog_name?: string | null; vertical?: string | null;
  last_synced_at?: string | null; last_sync_count?: number;
}

export type WeekDay = "mon" | "tue" | "wed" | "thu" | "fri" | "sat" | "sun";
export const WEEK_DAYS: WeekDay[] = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

/** Everyday automation: opening hours, away message, order messages, missed calls, in-chat payment. */
export interface WhatsAppAutomation {
  hours: { enabled: boolean; timezone: string; days: Record<WeekDay, [string, string][]> };
  away: { enabled: boolean; message: string };
  order_updates: { enabled: boolean };
  cart_reminder: { enabled: boolean; after_minutes: number; message: string };
  missed_call: { enabled: boolean; message: string };
  payment_configuration: string | null;
}

export interface WhatsAppBusinessProfile {
  about?: string | null;
  description?: string | null;
  address?: string | null;
  email?: string | null;
  websites?: string[] | null;
  vertical?: string | null;
  profile_picture_url?: string | null;
}

export interface WhatsAppInsights {
  days: number;
  chats: number;
  new_contacts: number;
  messages_received: number;
  messages_sent: number;
  answered_by: { ai: number; menu: number; flow: number; team: number; away: number; other: number };
  orders: { created: number; paid: number; revenue_minor: number; revenue_by_source_minor: Record<string, number> };
  ads: { chats: number; revenue_minor: number };
  per_day: Array<{ date: string; received: number; sent: number }>;
  campaigns: Array<{ id: string; name: string; sent: number; read: number; buyers: number; revenue_minor: number }>;
}

/** WhatsApp settings for the business's number. */
export interface WhatsAppSettings {
  number: {
    phone_number?: string | null;
    verified_name?: string | null;
    quality_rating?: string | null;
    status?: string | null;
    connected_at?: string | null;
  };
  ai_enabled: boolean;
  group_replies_enabled: boolean;
  /** Whether the platform admin includes AI replies in this account's plan. */
  ai_allowed: boolean;
  upi_id?: string | null;
  upi_payee_name?: string | null;
  automation: WhatsAppAutomation;
}

/** Changes to automation: send only the parts that changed. */
export type WhatsAppAutomationChange = {
  hours?: Partial<WhatsAppAutomation["hours"]>;
  away?: Partial<WhatsAppAutomation["away"]>;
  order_updates?: Partial<WhatsAppAutomation["order_updates"]>;
  cart_reminder?: Partial<WhatsAppAutomation["cart_reminder"]>;
  missed_call?: Partial<WhatsAppAutomation["missed_call"]>;
  payment_configuration?: string;
};

export interface WhatsAppAgentSummary {
  id: string;
  name: string;
  status: string;
  has_number: boolean;
}

/** What the number is wired to, and what is stopping messages. */
export interface WhatsAppConnectionHealth {
  connection: { waba_id?: string | null; phone_number?: string | null } | null;
  linked_agent: WhatsAppAgentSummary | null;
  agents: WhatsAppAgentSummary[];
  problems: { code: string; message: string }[];
  /** The latest delivery problem seen on this number. */
  last_issue?: { code: string; message: string; at: string } | null;
}

export interface WhatsAppGroup {
  group_id: string;
  last_at?: string | null;
  last_message?: string;
  messages: number;
  ai_enabled: boolean;
}

export interface StudioOrder {
  id: string; status: string; inventory_status: string; amount_minor: number;
  currency: string; customer_phone?: string | null; created_at: string;
  fulfillment_status?: "processing" | "shipped" | "fulfilled" | null;
  tracking_reference?: string | null;
  /** "upi" when paid through the business's own UPI ID (confirmed by hand). */
  payment_method?: "upi" | null;
  /** The UPI reference the customer sent, when they say they've paid. */
  upi_reference?: string | null;
  items: { product_id: string; sku: string; name: string; quantity: number; unit_price_minor: number; line_total_minor: number }[];
}

const DEFAULT_AUTOMATION: WhatsAppAutomation = {
  hours: { enabled: false, timezone: "Asia/Kolkata", days: { mon: [["10:00", "19:00"]], tue: [["10:00", "19:00"]], wed: [["10:00", "19:00"]], thu: [["10:00", "19:00"]], fri: [["10:00", "19:00"]], sat: [["10:00", "19:00"]], sun: [] } },
  away: { enabled: false, message: "Thanks for your message! We're closed right now and will reply when we open." },
  order_updates: { enabled: true },
  cart_reminder: { enabled: false, after_minutes: 60, message: "Your order is still waiting for you. Tap below to pay, or reply here if you need help." },
  missed_call: { enabled: true, message: "Sorry we missed your call! Send us a message here and we'll reply right away." },
  payment_configuration: null,
};

/** Fill in anything an older server doesn't send, so screens never crash on a missing section. */
function withAutomation(settings: WhatsAppSettings): WhatsAppSettings {
  const sent: Partial<WhatsAppAutomation> = settings.automation ?? {};
  return {
    ...settings,
    automation: {
      hours: { ...DEFAULT_AUTOMATION.hours, ...sent.hours },
      away: { ...DEFAULT_AUTOMATION.away, ...sent.away },
      order_updates: { ...DEFAULT_AUTOMATION.order_updates, ...sent.order_updates },
      cart_reminder: { ...DEFAULT_AUTOMATION.cart_reminder, ...sent.cart_reminder },
      missed_call: { ...DEFAULT_AUTOMATION.missed_call, ...sent.missed_call },
      payment_configuration: sent.payment_configuration ?? null,
    },
  };
}

const base = (businessId: string) => `/businesses/${businessId}/whatsapp-studio`;

export const whatsappStudioApi = {
  overview: (businessId: string) => api.get<WhatsAppStudioOverview>(`${base(businessId)}/overview`),

  contacts: async (businessId: string, filters: { search?: string; tag?: string; optedIn?: boolean; offset?: number; limit?: number } = {}) => {
    const query = new URLSearchParams();
    if (filters.search) query.set("search", filters.search);
    if (filters.tag) query.set("tag", filters.tag);
    if (filters.optedIn !== undefined) query.set("opted_in", String(filters.optedIn));
    if (filters.offset) query.set("offset", String(filters.offset));
    if (filters.limit) query.set("limit", String(filters.limit));
    const qs = query.toString();
    return api.get<{ contacts: WhatsAppStudioContact[]; total: number }>(`${base(businessId)}/contacts${qs ? `?${qs}` : ""}`);
  },

  customFieldKeys: async (businessId: string) => {
    const result = await api.get<{ fields: string[] }>(`${base(businessId)}/contacts/custom-fields`);
    return result.fields;
  },

  createContact: (
    businessId: string,
    contact: { phone: string; name?: string; tags?: string[]; custom_fields?: Record<string, string>; whatsapp_opt_in: boolean; opt_in_source?: string }
  ) => api.post<{ success: boolean; contact: WhatsAppStudioContact }>(`${base(businessId)}/contacts`, contact),

  updateContact: (businessId: string, contactId: string, contact: Partial<Pick<WhatsAppStudioContact, "name" | "email" | "tags" | "custom_fields" | "lead_status" | "whatsapp_opt_in">> & { opt_in_source?: string }) =>
    api.patch<{ success: boolean; contact: WhatsAppStudioContact }>(`${base(businessId)}/contacts/${contactId}`, contact),

  deleteContact: (businessId: string, contactId: string) =>
    api.delete<{ success: boolean }>(`${base(businessId)}/contacts/${contactId}`),

  importContacts: (businessId: string, file: File, defaultOptIn: boolean, groupTag?: string) => {
    const body = new FormData();
    body.append("file", file);
    body.append("default_opt_in", String(defaultOptIn));
    if (groupTag) body.append("group_tag", groupTag);
    return api.post<{ success: boolean; processed: number; created: number; updated: number; skipped: number }>(
      `${base(businessId)}/contacts/import`,
      body,
      { isFormData: true }
    );
  },

  segments: async (businessId: string) => {
    const result = await api.get<{ segments: WhatsAppStudioSegment[] }>(`${base(businessId)}/segments`);
    return result.segments;
  },

  createSegment: (businessId: string, name: string, tag: string) =>
    api.post<{ success: boolean; segment: WhatsAppStudioSegment }>(`${base(businessId)}/segments`, {
      name,
      description: tag ? `Contacts tagged ${tag}` : "All opted-in WhatsApp contacts",
      rules: {
        tags_any: tag ? [tag] : [],
        lead_statuses: [],
        sources: [],
        whatsapp_opt_in: true,
        interacted_within_days: null,
      },
    }),

  deleteSegment: (businessId: string, segmentId: string) =>
    api.delete<{ success: boolean }>(`${base(businessId)}/segments/${segmentId}`),

  flows: (businessId: string) =>
    api.get<{ flows: Omit<StudioFlow, "graph">[] }>(`${base(businessId)}/flows`),

  flow: async (businessId: string, flowId: string) => {
    const result = await api.get<{ flow: StudioFlow }>(`${base(businessId)}/flows/${flowId}`);
    return result.flow;
  },

  metaFlows: async (businessId: string) => {
    const result = await api.get<{ flows: StudioMetaFlow[] }>(`${base(businessId)}/flows/meta-flows`);
    return result.flows;
  },

  createMetaFlow: (
    businessId: string,
    form: { name: string; category: string; title: string; submit_label: string; fields: StudioMetaFormField[] }
  ) => api.post<{ success: boolean; flow: StudioMetaFlow; screen: string }>(`${base(businessId)}/flows/meta-flows`, form),

  deprecateMetaFlow: (businessId: string, flowId: string) =>
    api.post<{ success: boolean; flow: StudioMetaFlow }>(`${base(businessId)}/flows/meta-flows/${flowId}/deprecate`, {}),

  formSubmissions: async (businessId: string, params?: { limit?: number; skip?: number }) => {
    const search = new URLSearchParams();
    if (params?.limit) search.set("limit", String(params.limit));
    if (params?.skip) search.set("skip", String(params.skip));
    const qs = search.toString();
    return api.get<{ submissions: StudioFormSubmission[]; total: number }>(`${base(businessId)}/flows/submissions${qs ? `?${qs}` : ""}`);
  },

  createFlow: (businessId: string, flow: Pick<StudioFlow, "name" | "description" | "trigger_type" | "trigger_config" | "graph">) =>
    api.post<{ flow: StudioFlow }>(`${base(businessId)}/flows`, flow),

  updateFlow: (businessId: string, flowId: string, flow: Partial<Pick<StudioFlow, "name" | "description" | "trigger_type" | "trigger_config" | "graph">>) =>
    api.patch<{ flow: StudioFlow }>(`${base(businessId)}/flows/${flowId}`, flow),

  validateFlow: (businessId: string, flowId: string) =>
    api.post<StudioFlowValidation>(`${base(businessId)}/flows/${flowId}/validate`, {}),

  simulateFlow: (businessId: string, flowId: string, choices: Record<string, string> = {}) =>
    api.post<{ completed: boolean; trace: { node_id: string; type: StudioNodeType; label?: string }[]; stopped_reason?: string }>(
      `${base(businessId)}/flows/${flowId}/simulate`, { variables: {}, choices, max_steps: 50 }
    ),

  publishFlow: (businessId: string, flowId: string) =>
    api.post<{ success: boolean; version: number; flow: StudioFlow }>(`${base(businessId)}/flows/${flowId}/publish`, {}),

  unpublishFlow: (businessId: string, flowId: string) =>
    api.post<{ success: boolean; flow: StudioFlow; cleared_sessions?: number }>(`${base(businessId)}/flows/${flowId}/unpublish`, {}),

  deleteFlow: (businessId: string, flowId: string) =>
    api.delete<{ success: boolean }>(`${base(businessId)}/flows/${flowId}`),

  campaigns: async (businessId: string) => {
    const result = await api.get<{ campaigns: StudioCampaign[] }>(`${base(businessId)}/campaigns`);
    return result.campaigns;
  },

  campaignTemplates: async (businessId: string) => {
    const result = await api.get<{ templates: StudioApprovedTemplate[] }>(`${base(businessId)}/campaigns/approved-templates`);
    return result.templates;
  },

  createCampaign: (businessId: string, campaign: { name: string; mode: "broadcast" | "drip"; segment_id: string; steps: StudioCampaignStep[]; scheduled_at?: string | null }) =>
    api.post<{ campaign: StudioCampaign }>(`${base(businessId)}/campaigns`, campaign),

  activateCampaign: (businessId: string, campaignId: string) =>
    api.post<{ success: boolean; enrolled: number; scheduled_at: string }>(`${base(businessId)}/campaigns/${campaignId}/activate`, {}),

  pauseCampaign: (businessId: string, campaignId: string) =>
    api.post<{ success: boolean }>(`${base(businessId)}/campaigns/${campaignId}/pause`, {}),

  products: async (businessId: string) => {
    const result = await api.get<{ products: StudioProduct[] }>(`${base(businessId)}/commerce/products`);
    return result.products;
  },

  createProduct: (businessId: string, product: { sku: string; name: string; description?: string; price: string; currency: string; inventory: number; image_url?: string; active: boolean }) =>
    api.post<{ product: StudioProduct }>(`${base(businessId)}/commerce/products`, product),

  updateProduct: (businessId: string, productId: string, product: { sku: string; name: string; description?: string; price: string; currency: string; inventory: number; image_url?: string; active: boolean }) =>
    api.patch<{ product: StudioProduct }>(`${base(businessId)}/commerce/products/${productId}`, product),

  /** Copy the business's Products into the WhatsApp shop (safe to repeat: updates, never duplicates). */
  importFromProducts: (businessId: string) =>
    api.post<{ success: boolean; imported: number; updated: number; skipped: number }>(`${base(businessId)}/commerce/products/import-from-products`, {}),

  /** A wa.me link and QR code that open a chat with this number. */
  shareQr: (phone: string, message?: string) =>
    api.post<{ url: string; qr_data_uri: string; download_filename: string }>(`/qr/generate`, { channel: "whatsapp", identifier: phone, message: message || undefined }),

  catalogConnection: async (businessId: string) => {
    const result = await api.get<{ connection: StudioCatalogConnection | null }>(`${base(businessId)}/commerce/catalog-connection`);
    return result.connection;
  },

  connectCatalog: async (businessId: string, catalogId: string) => {
    const result = await api.put<{ connection: StudioCatalogConnection }>(`${base(businessId)}/commerce/catalog-connection`, { catalog_id: catalogId });
    return result.connection;
  },

  syncCatalog: (businessId: string) =>
    api.post<{ success: boolean; synced: number; needs_review: number }>(`${base(businessId)}/commerce/catalog-connection/sync`, {}),

  shareProduct: (businessId: string, productId: string, conversationRef: string, body?: string) =>
    api.post<{ success: boolean; message_id?: string; delivery_status: string }>(`${base(businessId)}/commerce/products/${productId}/share`, {
      conversation_ref: conversationRef,
      body: body || "See this product from our catalog.",
    }),

  orders: async (businessId: string) => {
    const result = await api.get<{ orders: StudioOrder[] }>(`${base(businessId)}/commerce/orders`);
    return result.orders;
  },

  createOrder: (businessId: string, order: { customer_phone?: string; items: { product_id: string; quantity: number }[] }) =>
    api.post<{ order: StudioOrder; checkout: { provider: "upi" | "razorpay"; key_id?: string; provider_order_id?: string; amount: number; currency: string; url: string; upi_link?: string; pay_within?: string } }>(`${base(businessId)}/commerce/orders`, order),

  /** Confirm a UPI payment after checking it arrived in your bank app. */
  markPaid: (businessId: string, orderId: string, reference?: string) =>
    api.post<{ success: boolean; order: StudioOrder }>(`${base(businessId)}/commerce/orders/${orderId}/mark-paid`, { reference: reference || undefined }),

  settings: (businessId: string) => api.get<WhatsAppSettings>(`${base(businessId)}/settings`).then(withAutomation),

  connectionHealth: (businessId: string) => api.get<WhatsAppConnectionHealth>(`${base(businessId)}/connection-health`),

  /** Make this agent the one that answers the number (also resumes it). */
  linkAgent: (wabaId: string, agentId: string) =>
    api.post<{ status: string }>(`/api/agents/whatsapp/onboarding/connections/${wabaId}/link-agent`, { agent_id: agentId }),

  updateSettings: (
    businessId: string,
    changes: Partial<Pick<WhatsAppSettings, "ai_enabled" | "group_replies_enabled" | "upi_id" | "upi_payee_name">> & { automation?: WhatsAppAutomationChange }
  ) => api.put<WhatsAppSettings>(`${base(businessId)}/settings`, changes).then(withAutomation),

  profile: (businessId: string) => api.get<{ profile: WhatsAppBusinessProfile; verticals: string[] }>(`${base(businessId)}/profile`),

  updateProfile: (businessId: string, changes: Partial<Omit<WhatsAppBusinessProfile, "profile_picture_url">>) =>
    api.put<{ profile: WhatsAppBusinessProfile; verticals: string[] }>(`${base(businessId)}/profile`, changes),

  uploadProfilePhoto: (businessId: string, file: File) => {
    const body = new FormData();
    body.append("file", file);
    return api.post<{ profile: WhatsAppBusinessProfile }>(`${base(businessId)}/profile/photo`, body, { isFormData: true });
  },

  calling: (businessId: string) => api.get<{ available: boolean; enabled: boolean; show_call_button: boolean }>(`${base(businessId)}/calling`),

  updateCalling: (businessId: string, changes: { enabled: boolean; show_call_button?: boolean }) =>
    api.put<{ available: boolean; enabled: boolean; show_call_button: boolean }>(`${base(businessId)}/calling`, changes),

  insights: (businessId: string, days: number) => api.get<WhatsAppInsights>(`${base(businessId)}/insights?days=${days}`),

  /** Contacts as a CSV download (goes through the app's own proxy, so the login travels with it). */
  exportContactsUrl: (businessId: string) => `/api/backend${base(businessId)}/contacts/export`,

  groups: (businessId: string) => api.get<{ groups: WhatsAppGroup[]; ai_enabled: boolean; group_replies_enabled: boolean }>(`${base(businessId)}/groups`),

  setGroupAi: (businessId: string, groupId: string, aiEnabled: boolean) =>
    api.put<{ group_id: string; ai_enabled: boolean }>(`${base(businessId)}/groups/${encodeURIComponent(groupId)}`, { ai_enabled: aiEnabled }),

  updateFulfillment: (businessId: string, orderId: string, status: "processing" | "shipped" | "fulfilled", trackingReference?: string) =>
    api.patch<{ success: boolean; order: StudioOrder }>(`${base(businessId)}/commerce/orders/${orderId}/fulfillment`, {
      status, tracking_reference: trackingReference || undefined,
    }),

  cancelOrder: (businessId: string, orderId: string) =>
    api.post<{ success: boolean; status: string }>(`${base(businessId)}/commerce/orders/${orderId}/cancel`, {}),

  track: (businessId: string, experience: "legacy" | "studio", event: string, task: string) =>
    api.post<void>(`${base(businessId)}/events`, { experience, event, task }),
};
