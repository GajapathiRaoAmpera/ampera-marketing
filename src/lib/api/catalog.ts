import { api } from "./client";

export interface CatalogItem {
  id: string;
  business_id: string;
  sku: string;
  name: string;
  price: number;
  currency: string;
  stock_qty?: number | null;
  active: boolean;
  created_at?: string;
  updated_at?: string;
}

export interface CatalogItemCreate {
  sku: string;
  name: string;
  price: number;
  currency: string;
  stock_qty?: number | null;
  active: boolean;
}

export type CatalogItemUpdate = Partial<Omit<CatalogItemCreate, "sku">>;

const base = (businessId: string) => `/businesses/${businessId}/catalog`;

export const catalogApi = {
  list: async (businessId: string) => {
    const result = await api.get<{ items: CatalogItem[] }>(base(businessId));
    return result.items;
  },

  create: (businessId: string, item: CatalogItemCreate) =>
    api.post<{ item: CatalogItem }>(base(businessId), item),

  update: (businessId: string, itemId: string, item: CatalogItemUpdate) =>
    api.patch<{ item: CatalogItem }>(`${base(businessId)}/${itemId}`, item),

  remove: (businessId: string, itemId: string) =>
    api.delete<{ success: boolean }>(`${base(businessId)}/${itemId}`),
};
