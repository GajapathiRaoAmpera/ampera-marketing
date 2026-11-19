import { api } from "./client";
import type { AccountUsage, ApprovalStatus, TierId } from "./admin";
import type { AccountPeriodState, BillingInterval, Countdown, FreeTrialInfo } from "./billing";

export interface EntitlementFeature {
  key: string;
  label: string;
  description: string;
  category: "channel" | "feature";
  /** false = shown locked: the plan or the admin has not turned it on. */
  enabled: boolean;
}

export interface EntitlementLimit {
  key: string;
  label: string;
  /** null = unlimited */
  value: number | null;
}

/** What the signed-in business's plan lets it do, and how much it has used. */
export interface Entitlements {
  approval_status: ApprovalStatus;
  awaiting_approval: boolean;
  plan_id: TierId;
  plan_name: string;
  is_trial: boolean;
  /** The free period is over and nothing paid is running: locked until the account subscribes. */
  is_expired: boolean;
  /** Which period the account is in, and how long it has left. */
  subscription: {
    state: AccountPeriodState;
    billing_interval: BillingInterval | null;
    in_grace: boolean;
    trial: FreeTrialInfo | null;
    countdown: Countdown | null;
  };
  features: EntitlementFeature[];
  limits: EntitlementLimit[];
  usage: AccountUsage;
  /** Channels this business has set up (e.g. "instagram", "whatsapp"). */
  connected_channels?: string[];
}

export const entitlementsApi = {
  get: (businessId: string) => api.get<Entitlements>(`/businesses/${businessId}/entitlements`),
};
