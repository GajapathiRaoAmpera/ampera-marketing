import { api } from "./client";

export interface InstagramConnectionStatus {
  connected: boolean;
  instagram_business_id?: string | null;
  instagram_username?: string | null;
  agent_id?: string | null;
  connected_at?: string | null;
  connection_id?: string | null;
  business_id?: string | null;
  health_status?: string | null;
}

interface OnboardingCompleteResponse {
  status: string;
  instagram_business_id: string;
  instagram_username: string;
  webhook_configured: boolean;
  agent_id: string | null;
}

export interface InstagramDisconnectResponse {
  success: boolean;
  message: string;
  manual_removal_required: boolean;
  instagram_removal_url: string | null;
}

export const instagramApi = {
  status: (businessId?: string) =>
    api.get<InstagramConnectionStatus>(`/users/instagram/status${businessId ? `?business_id=${encodeURIComponent(businessId)}` : ""}`),

  // Called once FB.login's popup resolves with an authorization code.
  completeOnboarding: (code: string, agentId?: string, businessId?: string) =>
    api.post<OnboardingCompleteResponse>("/users/instagram/onboarding/complete", {
      code,
      agent_id: agentId,
      business_id: businessId,
    }),

  linkAgent: (agentId: string) => api.post("/users/instagram/link-agent", { agent_id: agentId }),

  disconnect: (businessId?: string) =>
    api.delete<InstagramDisconnectResponse>(
      `/users/instagram/disconnect${businessId ? `?business_id=${encodeURIComponent(businessId)}` : ""}`
    ),
};
