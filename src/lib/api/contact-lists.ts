import { api } from "./client";

export interface ContactListMember {
  phone: string;
  name?: string | null;
  variables?: Record<string, string>;
}

export interface ContactList {
  id: string;
  user_id: string;
  name: string;
  member_count: number;
  members?: ContactListMember[]; // present only on the single-list GET, not the list view
  // Names of extra CSV columns (beyond phone/name), in "1", "2"... order:
  // e.g. ["City", "Order ID"] means every member's variables["1"] came from
  // the "City" column. Empty for lists created via manual/pasted numbers.
  variable_columns: string[];
  created_at: string;
  updated_at: string;
}

interface ContactListsResponse {
  contact_lists: ContactList[];
  total: number;
}

interface CreateContactListResponse {
  success: boolean;
  contact_list: ContactList;
  skipped_rows?: number;
}

export const contactListsApi = {
  listAll: async (): Promise<ContactList[]> => {
    const res = await api.get<ContactListsResponse>("/contact-lists");
    return res.contact_lists;
  },

  get: (listId: string) => api.get<ContactList>(`/contact-lists/${listId}`),

  createManual: (name: string, members: { phone: string; name?: string }[]) =>
    api.post<CreateContactListResponse>("/contact-lists", { name, members }),

  uploadCsv: (name: string, file: File) => {
    const formData = new FormData();
    formData.append("name", name);
    formData.append("file", file);
    return api.post<CreateContactListResponse>("/contact-lists/upload", formData, { isFormData: true });
  },

  delete: (listId: string) => api.delete<{ success: boolean }>(`/contact-lists/${listId}`),
};
