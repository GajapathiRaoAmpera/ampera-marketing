import { api } from "./client";

/**
 * API clients for the four real-but-approval-gated marketplace connectors:
 * Amazon SP-API, Flipkart Seller API, Meesho Supplier API, Myntra Partner
 * Portal API. All four are REAL client code (OAuth/credential exchange +
 * real endpoint calls) per each platform's public API documentation, see
 * app/services/{amazon,flipkart,meesho,myntra}/client.py's docstrings on
 * the backend. None can be authenticated against a live account from this
 * environment: every business connecting through these pages needs its OWN
 * marketplace-approved seller/partner API credentials from that platform's
 * developer portal. This is NOT the same tier as Shopify/WooCommerce/
 * IndiaMART's "just works" connect flow, see each page's copy.
 */

export interface MarketplaceProduct {
  id: string;
  name: string;
  description?: string | null;
  price?: string | number | null;
  image_url?: string | null;
  stock_status: string;
  sku?: string | null;
}

export interface MarketplaceOrder {
  order_number: string;
  email: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  total_price: string | number | null;
  currency: string | null;
  created_at: string | null;
  items: { title: string; quantity: number; price: string | number }[];
  shipping_to: string;
  tracking: string | null;
}

// ── Amazon ───────────────────────────────────────────────────────────────

export interface AmazonStatus {
  connected: boolean;
  seller_id?: string;
  region?: string;
  status?: string;
  connected_at?: string | null;
}

const amazonBase = (businessId: string) => `/businesses/${businessId}/amazon`;

export const amazonApi = {
  status: (businessId: string) => api.get<AmazonStatus>(`${amazonBase(businessId)}/status`),
  authorize: (businessId: string) =>
    api.get<{ authorize_url: string; state: string }>(`${amazonBase(businessId)}/authorize`),
  disconnect: (businessId: string) => api.delete<{ success: boolean }>(`${amazonBase(businessId)}/disconnect`),
  setAwsCredentials: (businessId: string, payload: { aws_access_key_id: string; aws_secret_access_key: string }) =>
    api.post<{ success: boolean }>(`${amazonBase(businessId)}/aws-credentials`, payload),
  products: async (businessId: string, limit = 20): Promise<MarketplaceProduct[]> => {
    const res = await api.get<{ products: MarketplaceProduct[] }>(`${amazonBase(businessId)}/products?limit=${limit}`);
    return res.products;
  },
  lookupOrder: (businessId: string, orderId: string) =>
    api.get<MarketplaceOrder>(`${amazonBase(businessId)}/orders/${encodeURIComponent(orderId)}`),
};

// ── Flipkart ─────────────────────────────────────────────────────────────

export interface FlipkartStatus {
  connected: boolean;
  application_id?: string;
  status?: string;
  connected_at?: string | null;
}

const flipkartBase = (businessId: string) => `/businesses/${businessId}/flipkart`;

export const flipkartApi = {
  status: (businessId: string) => api.get<FlipkartStatus>(`${flipkartBase(businessId)}/status`),
  connect: (businessId: string, payload: { application_id: string; application_secret: string }) =>
    api.post<{ success: boolean; message: string }>(`${flipkartBase(businessId)}/connect`, payload),
  disconnect: (businessId: string) => api.delete<{ success: boolean }>(`${flipkartBase(businessId)}/disconnect`),
  products: async (businessId: string, limit = 20): Promise<MarketplaceProduct[]> => {
    const res = await api.get<{ products: MarketplaceProduct[] }>(`${flipkartBase(businessId)}/products?limit=${limit}`);
    return res.products;
  },
  lookupOrder: (businessId: string, orderId: string) =>
    api.get<MarketplaceOrder>(`${flipkartBase(businessId)}/orders/${encodeURIComponent(orderId)}`),
};

// ── Meesho (catalog only, no order lookup, see backend client docstring) ──

export interface MeeshoStatus {
  connected: boolean;
  supplier_id?: string;
  status?: string;
  connected_at?: string | null;
  order_lookup_available?: boolean;
}

const meeshoBase = (businessId: string) => `/businesses/${businessId}/meesho`;

export const meeshoApi = {
  status: (businessId: string) => api.get<MeeshoStatus>(`${meeshoBase(businessId)}/status`),
  connect: (businessId: string, payload: { supplier_id: string; api_key: string }) =>
    api.post<{ success: boolean; message: string }>(`${meeshoBase(businessId)}/connect`, payload),
  disconnect: (businessId: string) => api.delete<{ success: boolean }>(`${meeshoBase(businessId)}/disconnect`),
  products: async (businessId: string, limit = 20): Promise<MarketplaceProduct[]> => {
    const res = await api.get<{ products: MarketplaceProduct[] }>(`${meeshoBase(businessId)}/products?limit=${limit}`);
    return res.products;
  },
};

// ── Myntra (catalog only, no order lookup, see backend client docstring) ──

export interface MyntraStatus {
  connected: boolean;
  client_id?: string;
  status?: string;
  connected_at?: string | null;
  order_lookup_available?: boolean;
}

const myntraBase = (businessId: string) => `/businesses/${businessId}/myntra`;

export const myntraApi = {
  status: (businessId: string) => api.get<MyntraStatus>(`${myntraBase(businessId)}/status`),
  connect: (businessId: string, payload: { client_id: string; client_secret: string }) =>
    api.post<{ success: boolean; message: string }>(`${myntraBase(businessId)}/connect`, payload),
  disconnect: (businessId: string) => api.delete<{ success: boolean }>(`${myntraBase(businessId)}/disconnect`),
  products: async (businessId: string, limit = 20): Promise<MarketplaceProduct[]> => {
    const res = await api.get<{ products: MarketplaceProduct[] }>(`${myntraBase(businessId)}/products?limit=${limit}`);
    return res.products;
  },
};
