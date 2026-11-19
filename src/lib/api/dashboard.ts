import { api } from "./client";
import type { AnalyticsAi, AnalyticsOverview, AnalyticsSales, DashboardHome } from "@/types/api";

export const dashboardApi = {
  home: (businessId: string) => api.get<DashboardHome>(`/businesses/${businessId}/dashboard`),

  analyticsOverview: (businessId: string) =>
    api.get<AnalyticsOverview>(`/businesses/${businessId}/analytics/overview`),

  analyticsSales: (businessId: string) => api.get<AnalyticsSales>(`/businesses/${businessId}/analytics/sales`),

  analyticsAi: (businessId: string) => api.get<AnalyticsAi>(`/businesses/${businessId}/analytics/ai`),
};
