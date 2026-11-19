import { api } from "./client";

export interface Product {
  id: string;
  business_id: string;
  agent_id?: string;
  name: string;
  description?: string | null;
  keywords: string[];
  price?: number | null;
  currency: string;
  stock_qty?: number | null;
  image_url?: string | null;
  active: boolean;
  source: "manual" | "sheet" | "file" | "woocommerce" | "indiamart" | "custom_store";
  sheet_id?: string | null;
  sheet_row_ref?: string | null;
  external_id?: string | null;
  rag_chunk_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProductFormInput {
  name: string;
  description?: string;
  keywords?: string[];
  price?: number;
  currency?: string;
  stockQty?: number;
  active?: boolean;
  imageFile?: File | null;
  imageLink?: string;
}

function toFormData(input: Partial<ProductFormInput>): FormData {
  const form = new FormData();
  if (input.name !== undefined) form.append("name", input.name);
  if (input.description !== undefined) form.append("description", input.description);
  if (input.keywords !== undefined) form.append("keywords", input.keywords.join(","));
  if (input.price !== undefined) form.append("price", String(input.price));
  if (input.currency !== undefined) form.append("currency", input.currency);
  if (input.stockQty !== undefined) form.append("stock_qty", String(input.stockQty));
  if (input.active !== undefined) form.append("active", String(input.active));
  if (input.imageFile) form.append("image_file", input.imageFile);
  if (input.imageLink) form.append("image_link", input.imageLink);
  return form;
}

const base = (businessId: string) => `/businesses/${businessId}/products`;

export const productsApi = {
  list: async (businessId: string): Promise<Product[]> => {
    const res = await api.get<{ items: Product[] }>(base(businessId));
    return res.items;
  },

  create: (businessId: string, input: ProductFormInput) =>
    api.post<{ product: Product }>(base(businessId), toFormData(input), { isFormData: true }),

  update: (businessId: string, productId: string, input: Partial<ProductFormInput>) =>
    api.patch<{ product: Product }>(`${base(businessId)}/${productId}`, toFormData(input), { isFormData: true }),

  remove: (businessId: string, productId: string) =>
    api.delete<{ success: boolean }>(`${base(businessId)}/${productId}`),
};
