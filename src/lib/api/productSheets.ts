import { api } from "./client";
import type { Product } from "./products";

export interface MappedProductRow {
  name: string;
  description: string | null;
  keywords: string[];
  price: number | null;
  stock_qty: number | null;
  image_link: string | null;
}

export interface SheetPreviewRow {
  row_index: number;
  mapped: MappedProductRow;
  raw: Record<string, string>;
}

export interface SheetColumnMapping {
  name: string | null;
  description: string | null;
  keywords: string | null;
  price: string | null;
  stock_qty: string | null;
  image_link: string | null;
}

export interface SheetPreview {
  sheet_id: string;
  gid: string;
  headers: string[];
  mapping: SheetColumnMapping;
  rows: SheetPreviewRow[];
  row_count: number;
}

export interface SheetImportRun {
  id: string;
  business_id: string;
  sheet_id: string;
  sheet_url: string;
  gid: string;
  created_at: string;
  added: number;
  updated: number;
  removed: number;
  failed: number;
  status: "success" | "partial" | "failed";
  row_errors: { row_index: number; error: string }[];
}

export interface SheetImportResult {
  import: SheetImportRun;
  products: Product[];
}

const base = (businessId: string) => `/businesses/${businessId}/product-sheets`;

export const productSheetsApi = {
  preview: (businessId: string, sheetUrl: string) =>
    api.post<SheetPreview>(`${base(businessId)}/preview`, { sheet_url: sheetUrl }),

  confirm: (
    businessId: string,
    payload: { sheet_url: string; mapping?: SheetColumnMapping; rows?: SheetPreviewRow[] }
  ) => api.post<SheetImportResult>(`${base(businessId)}/confirm`, payload),

  listImports: async (businessId: string): Promise<SheetImportRun[]> => {
    const res = await api.get<{ imports: SheetImportRun[] }>(`${base(businessId)}/imports`);
    return res.imports;
  },

  resync: (businessId: string, sheetId: string) =>
    api.post<SheetImportResult>(`${base(businessId)}/imports/${sheetId}/resync`, {}),
};
