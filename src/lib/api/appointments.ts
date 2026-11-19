import { api } from "./client";

export type AppointmentStatus = "pending" | "confirmed" | "cancelled";

export interface Appointment {
  id: string;
  business_id: string;
  customer_name?: string | null;
  requested_at: string;
  duration_minutes: number;
  status: AppointmentStatus;
  source: string;
  call_sid?: string | null;
  notes?: string | null;
  created_at?: string;
}

const base = (businessId: string) => `/businesses/${businessId}/appointments`;

export const appointmentsApi = {
  list: async (businessId: string, status?: AppointmentStatus) => {
    const query = status ? `?status=${status}` : "";
    const result = await api.get<{ appointments: Appointment[] }>(`${base(businessId)}${query}`);
    return result.appointments;
  },

  updateStatus: (businessId: string, appointmentId: string, status: AppointmentStatus) =>
    api.patch<{ appointment: Appointment }>(`${base(businessId)}/${appointmentId}`, { status }),
};
