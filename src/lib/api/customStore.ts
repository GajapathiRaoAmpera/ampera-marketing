import { api } from "./client";
import type { Product } from "./products";

export interface CustomStoreFeedRow {
  row_index: number;
  mapped: {
    name: string;
    description: string | null;
    price: number | null;
    image_url: string | null;
    external_id: string | null;
    stock_qty: number | null;
  };
}

export interface CustomStoreFeedMapping {
  name: string | null;
  description: string | null;
  price: string | null;
  image_url: string | null;
  id: string | null;
  stock_qty: string | null;
}

export interface CustomStoreFeedPreview {
  feed_url: string;
  mapping: CustomStoreFeedMapping;
  rows: CustomStoreFeedRow[];
  row_count: number;
}

export interface CustomStoreCommitResult {
  added: number;
  updated: number;
  failed: number;
  products: Product[];
}

export interface CustomStoreRefreshResult extends CustomStoreCommitResult {
  removed: number;
  feed_url: string;
}

const base = (businessId: string) => `/businesses/${businessId}/custom-store`;

export const customStoreApi = {
  preview: (businessId: string, feedUrl: string) =>
    api.post<CustomStoreFeedPreview>(`${base(businessId)}/preview`, { feed_url: feedUrl }),

  confirm: (businessId: string, feedUrl: string, rows: CustomStoreFeedRow["mapped"][]) =>
    api.post<CustomStoreCommitResult>(`${base(businessId)}/confirm`, { feed_url: feedUrl, rows }),

  listProducts: async (businessId: string): Promise<Product[]> => {
    const res = await api.get<{ products: Product[] }>(`${base(businessId)}/products`);
    return res.products;
  },

  refresh: (businessId: string) => api.post<CustomStoreRefreshResult>(`${base(businessId)}/refresh`, {}),
};
