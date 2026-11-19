import { api } from "./client";
import type { Notification, ActivityFeedItem } from "@/types/api";

interface NotificationsListResponse {
  notifications: Notification[];
  total: number;
}

interface UnreadCountResponse {
  unread_count: number;
}

interface ActivityFeedResponse {
  items: ActivityFeedItem[];
  total: number;
}

export const notificationsApi = {
  /** New notifications since `since` (ISO), plus the unread count: what the bell polls. */
  updates: (since?: string | null) =>
    api.get<{ notifications: Notification[]; unread_count: number; server_time: string }>(
      `/notifications/updates${since ? `?since=${encodeURIComponent(since)}` : ""}`
    ),

  list: async (unreadOnly = false, limit = 50): Promise<Notification[]> => {
    const qs = `?limit=${limit}${unreadOnly ? "&unread_only=true" : ""}`;
    const res = await api.get<NotificationsListResponse>(`/notifications${qs}`);
    return res.notifications;
  },

  markRead: (notificationId: string) => api.patch(`/notifications/${notificationId}/read`),

  markAllRead: () => api.post("/notifications/mark-all-read"),

  unreadCount: async (): Promise<number> => {
    const res = await api.get<UnreadCountResponse>("/notifications/unread-count");
    return res.unread_count;
  },

  activityFeed: async (businessId?: string): Promise<ActivityFeedItem[]> => {
    const qs = businessId ? `?business_id=${encodeURIComponent(businessId)}` : "";
    const res = await api.get<ActivityFeedResponse>(`/activity-feed${qs}`);
    return res.items;
  },
};
