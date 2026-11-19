import { api } from "./client";

// ── API Keys: for external automation tools (Zapier/Make/n8n/Google Sheets)
// authenticating against /api/v1/public/... ──

export interface ApiKey {
  id: string;
  business_id: string;
  created_by: string;
  label: string;
  key_prefix: string;
  active: boolean;
  created_at?: string;
  last_used_at?: string | null;
  revoked_at?: string | null;
}

export interface CreatedApiKey extends ApiKey {
  /** Only ever present on the create response - the raw key is never
   * retrievable again after this, only its hash is stored server-side. */
  api_key: string;
}

const apiKeysBase = (businessId: string) => `/businesses/${businessId}/api-keys`;

export const apiKeysApi = {
  list: async (businessId: string) => {
    const result = await api.get<{ api_keys: ApiKey[]; total: number }>(apiKeysBase(businessId));
    return result.api_keys;
  },
  create: (businessId: string, label: string) =>
    api.post<{ success: boolean; api_key: CreatedApiKey }>(apiKeysBase(businessId), { label }),
  revoke: (businessId: string, keyId: string) =>
    api.delete<{ success: boolean }>(`${apiKeysBase(businessId)}/${keyId}`),
};

// ── Cross-App Trigger Rules: "if this happens on platform A, do that on
// platform B" (e.g. Instagram comment -> WhatsApp broadcast) ──

export type TriggerSource = "instagram_comment" | "lead_scored" | "sentiment_negative" | "shopify_order_created";
export type TriggerAction = "whatsapp_broadcast" | "telegram_post" | "sms_send" | "outbound_webhook";

export interface TriggerRule {
  id: string;
  business_id: string;
  user_id: string;
  name: string;
  trigger_source: TriggerSource;
  trigger_config: Record<string, unknown>;
  action_type: TriggerAction;
  action_config: Record<string, unknown>;
  active: boolean;
  created_at?: string;
  fire_count: number;
}

export interface CreateTriggerRuleInput {
  name: string;
  trigger_source: TriggerSource;
  trigger_config: Record<string, unknown>;
  action_type: TriggerAction;
  action_config: Record<string, unknown>;
}

const triggerRulesBase = (businessId: string) => `/businesses/${businessId}/trigger-rules`;

export const triggerRulesApi = {
  list: async (businessId: string) => {
    const result = await api.get<{
      rules: TriggerRule[];
      total: number;
      valid_sources: TriggerSource[];
      valid_actions: TriggerAction[];
    }>(triggerRulesBase(businessId));
    return result;
  },
  create: (businessId: string, input: CreateTriggerRuleInput) =>
    api.post<{ success: boolean; rule: TriggerRule }>(triggerRulesBase(businessId), input),
  setActive: (businessId: string, ruleId: string, active: boolean) =>
    api.patch<{ success: boolean; active: boolean }>(`${triggerRulesBase(businessId)}/${ruleId}`, { active }),
  remove: (businessId: string, ruleId: string) =>
    api.delete<{ success: boolean }>(`${triggerRulesBase(businessId)}/${ruleId}`),
};

// ── Connected Apps Dashboard: one-shot summary of every platform a
// business can connect, plus how many active trigger rules reference each ──

export interface ConnectedAppSummary {
  connected: boolean;
  active?: boolean;
  name?: string;
  session_count?: number;
  active_trigger_rules: number;
  /** True for platforms with no connector built yet - the UI renders
   * these as disabled with a plain "Coming soon" badge. */
  coming_soon?: boolean;
  /** True for the four real-but-approval-gated marketplace connectors
   * (amazon/flipkart/meesho/myntra): the OAuth/credential exchange and
   * product/order endpoint code is real and built, but each business
   * needs its OWN marketplace-approved seller/partner API credentials
   * before it can authenticate - distinct from `coming_soon` (not built)
   * and from a plain "Connect" card (works today, e.g. Shopify/WooCommerce).
   * The UI should render a "Setup required" badge and route through to a
   * page that explains the credential requirement, not a bare connect form. */
  needs_setup?: boolean;
  /** Only meaningful when needs_setup is true: whether this platform's
   * public API docs actually support looking up a single order (Amazon,
   * Flipkart: yes, Meesho, Myntra: no documented endpoint found). */
  order_lookup_available?: boolean;
  /** Connected stores only: what the store is actually doing. Every field is optional because the
   *  backend only reports numbers it records. */
  stats?: {
    products?: number;
    leads_7d?: number;
    last_sync_at?: string | null;
    /** A plain-language problem to fix (e.g. an expired IndiaMART key). */
    problem?: string;
  };
  /** Amazon: false when this server has no Amazon developer app registered, so nobody can connect yet. */
  available?: boolean;
  /** Shopify: false when order updates are switched off on the server. */
  order_updates_ready?: boolean;
}

export interface ConnectedAppsResponse {
  business_id: string;
  apps: Record<string, ConnectedAppSummary>;
  total_trigger_rules: number;
}

export const connectedAppsApi = {
  get: (businessId: string) => api.get<ConnectedAppsResponse>(`/businesses/${businessId}/connected-apps`),
};
