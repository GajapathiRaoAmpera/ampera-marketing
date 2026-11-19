import { api } from "./client";
import type { Business } from "@/types/api";

// The backend wraps create/list/update responses in an envelope
// ({ success, business } / { businesses, total }) rather than returning
// bare objects/arrays, confirmed against app/api/routes/businesses/businesses.py.
// Only GET /businesses/{id} returns the bare Business object.

export const businessesApi = {
  list: async (): Promise<Business[]> => {
    const res = await api.get<{ businesses: Business[]; total: number }>("/businesses");
    return res.businesses;
  },

  create: async (input: { name: string } & Partial<Business>): Promise<Business> => {
    const res = await api.post<{ success: boolean; business: Business }>("/businesses", input);
    return res.business;
  },

  get: (businessId: string) => api.get<Business>(`/businesses/${businessId}`),

  update: async (businessId: string, input: Partial<Business>): Promise<Business> => {
    const res = await api.patch<{ success: boolean; business: Business }>(`/businesses/${businessId}`, input);
    return res.business;
  },
};
