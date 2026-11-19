import { api } from "./client";
import type { RagDocument, RagUploadResult } from "@/types/api";

interface RagListResponse {
  documents: RagDocument[];
  total: number;
}

export const ragApi = {
  list: async (businessId: string): Promise<RagDocument[]> => {
    const res = await api.get<RagListResponse>(`/rag/documents?business_id=${businessId}`);
    return res.documents;
  },

  // Returns a minimal ack ({success, doc_id, ...}), NOT a full RagDocument -
  // callers should refresh the list afterward rather than use this directly.
  upload: (businessId: string, file: File, description?: string, imagePublicUrl?: string) => {
    const form = new FormData();
    form.append("file", file);
    form.append("business_id", businessId);
    if (description) form.append("description", description);
    if (imagePublicUrl) form.append("image_public_url", imagePublicUrl);
    return api.post<RagUploadResult>("/rag/documents/upload", form, { isFormData: true });
  },

  ingestUrl: (businessId: string, url: string, description?: string) =>
    api.post<RagUploadResult>("/rag/documents/ingest-url", { url, business_id: businessId, description }),

  remove: (docId: string) => api.delete<{ success: boolean; doc_id: string; message: string }>(
    `/rag/documents/${docId}`
  ),
};
