import { api } from "./client";
import type { WhatsAppOfficialConnection } from "@/types/api";

interface OfficialInitResponse {
  signup_url: string;
  state: string;
  expires_at: string;
}

interface OfficialConnectionsResponse {
  connections: WhatsAppOfficialConnection[];
  count: number;
}

interface OfficialCompleteResponse {
  status: string;
  waba_id: string;
  phone_number_id: string;
  phone_number: string;
  business_name: string | null;
  webhook_configured: boolean;
  agent_id: string | null;
}

interface ManualConnectInput {
  whatsappBusinessAccountId: string;
  phoneNumberId: string;
  accessToken: string;
  agentId?: string;
}

export const whatsappApi = {
  // Official Meta Embedded Signup - Facebook JS SDK popup (FB.login + config_id).
  official: {
    initOnboarding: async (): Promise<{ url: string }> => {
      const res = await api.post<OfficialInitResponse>("/api/agents/whatsapp/onboarding/init");
      return { url: res.signup_url };
    },

    // Called once FB.login's popup resolves with a WA_EMBEDDED_SIGNUP code.
    completeOnboarding: (code: string, agentId?: string) =>
      api.post<OfficialCompleteResponse>("/api/agents/whatsapp/onboarding/complete", {
        code,
        agent_id: agentId,
      }),

    listConnections: async (): Promise<WhatsAppOfficialConnection[]> => {
      const res = await api.get<OfficialConnectionsResponse>("/api/agents/whatsapp/onboarding/connections");
      return res.connections;
    },

    // Alternative to the FB.login popup - paste a WABA ID/phone_number_id/access
    // token directly (e.g. from Meta's free "API Setup" test number page).
    manualConnect: (input: ManualConnectInput) =>
      api.post<OfficialCompleteResponse>("/api/agents/whatsapp/onboarding/manual-connect", {
        whatsapp_business_account_id: input.whatsappBusinessAccountId,
        phone_number_id: input.phoneNumberId,
        access_token: input.accessToken,
        agent_id: input.agentId,
      }),

    // Does NOT revoke the token on Meta's side - only removes our stored record.
    disconnect: (wabaId: string) =>
      api.delete<{ success: boolean }>(`/api/agents/whatsapp/onboarding/connections/${wabaId}`),
  },
};
