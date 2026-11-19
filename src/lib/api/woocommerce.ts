import { api } from "./client";

export interface WooCommerceStore {
  store_url: string;
  store_name: string | null;
  connected_at: string | null;
  last_synced_at: string | null;
  products_synced: number;
}

export interface ConnectWooCommerceResult {
  success: boolean;
  store_url: string;
  store_name: string;
  agent_id: string;
  message: string;
}

export interface WooCommerceProduct {
  id: string;
  name: string;
  description: string;
  price: string | null;
  regular_price: string | null;
  image_url: string | null;
  permalink: string | null;
  stock_status: string;
  stock_quantity: number | null;
  sku: string | null;
}

export interface WooCommerceOrder {
  order_number: string;
  email: string | null;
  financial_status: string | null;
  fulfillment_status: string | null;
  total_price: string | null;
  currency: string | null;
  created_at: string | null;
  items: { title: string; quantity: number; price: string }[];
  shipping_to: string;
  tracking: string | null;
}

const base = (businessId: string) => `/businesses/${businessId}/woocommerce`;

export const woocommerceApi = {
  connect: (
    businessId: string,
    payload: { store_url: string; consumer_key: string; consumer_secret: string; webhook_secret?: string }
  ) => api.post<ConnectWooCommerceResult>(`${base(businessId)}/connect`, payload),

  listStores: async (businessId: string): Promise<WooCommerceStore[]> => {
    const res = await api.get<{ stores: WooCommerceStore[] }>(`${base(businessId)}/stores`);
    return res.stores;
  },

  disconnect: (businessId: string, storeUrl: string) =>
    api.delete<{ success: boolean }>(`${base(businessId)}/stores/${encodeURIComponent(storeUrl)}`),

  sync: (businessId: string, storeUrl: string) =>
    api.post<{ success: boolean; message: string }>(`${base(businessId)}/sync/${encodeURIComponent(storeUrl)}`, {}),

  browseProducts: async (
    businessId: string,
    storeUrl: string,
    query?: string
  ): Promise<WooCommerceProduct[]> => {
    const params = new URLSearchParams({ store_url: storeUrl });
    if (query) params.set("query", query);
    const res = await api.get<{ products: WooCommerceProduct[] }>(`${base(businessId)}/products?${params}`);
    return res.products;
  },

  lookupOrder: (businessId: string, storeUrl: string, orderNumber: string) =>
    api.get<WooCommerceOrder>(
      `${base(businessId)}/orders/${encodeURIComponent(orderNumber)}?store_url=${encodeURIComponent(storeUrl)}`
    ),
};
