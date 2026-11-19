import { api } from "./client";
import type { Product } from "./products";
import type { MappedProductRow, SheetColumnMapping, SheetImportRun, SheetPreviewRow } from "./productSheets";

export interface FileImportPreview {
  filename: string;
  headers: string[];
  mapping: SheetColumnMapping;
  rows: SheetPreviewRow[];
  row_count: number;
}

export interface FileImportResult {
  import: SheetImportRun;
  products: Product[];
}

const base = (businessId: string) => `/businesses/${businessId}/product-imports`;

export const productFileImportApi = {
  preview: (businessId: string, file: File) => {
    const form = new FormData();
    form.append("file", file);
    return api.post<FileImportPreview>(`${base(businessId)}/preview`, form, { isFormData: true });
  },

  confirm: (businessId: string, filename: string, rows: { row_index: number; mapped: MappedProductRow }[]) =>
    api.post<FileImportResult>(`${base(businessId)}/confirm`, { filename, rows }),
};
