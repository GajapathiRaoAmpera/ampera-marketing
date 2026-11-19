import { api } from "./client";

export interface PlanLimits {
  agents: number | null; // null = unlimited
  channels: number | null;
  messages_per_month: number | null;
  whatsapp_accounts: number | null;
  team_seats: number | null;
  contacts: number | null;
  widget_sites: number | null;
}

/** How often a paid plan bills. */
export type BillingInterval = "monthly" | "quarterly" | "half_yearly" | "annual";

export interface BillingIntervalInfo {
  label: string;
  /** Length of one cycle. */
  months: number;
  /** Taken off paying that many separate months. */
  discount_pct: number;
}

export interface Plan {
  name: string;
  price_monthly: number | null; // null = "Contact us" (Enterprise)
  /** What one cycle costs, per billing interval. Empty for plans you cannot buy online. */
  prices: Partial<Record<BillingInterval, number>>;
  stripe_price_id: string | null;
  limits: PlanLimits;
  features: string[];
}

export type PlanId = "free" | "pro" | "enterprise";

interface PlansResponse {
  plans: Record<PlanId, Plan>;
  intervals: Record<BillingInterval, BillingIntervalInfo>;
}

/** Which period an account is in:
 * pending = waiting for approval; free_trial = free tier with an end date;
 * free = free tier with no end date; paid = inside a paid billing cycle;
 * expired = the free period is over and nothing paid is running. */
export type AccountPeriodState = "pending" | "free_trial" | "free" | "paid" | "expired";

/** Time left until the end of the current period. */
export interface Countdown {
  /** free_trial = the free period; subscription = the paid cycle; grace = a late renewal. */
  kind: "free_trial" | "subscription" | "grace";
  /** UTC, ISO 8601. */
  ends_at: string;
  seconds_remaining: number;
  /** Whole days, rounded up. */
  days_remaining: number;
  expired: boolean;
}

export interface FreeTrialInfo {
  started_at: string;
  /** Total length of the free period; null = it never ends. */
  days: number | null;
  ends_at: string | null;
  countdown: Countdown | null;
}

export interface Subscription {
  /** The plan whose numbers apply right now ("expired" once the free period is over). */
  plan_id: PlanId | "trial" | "expired";
  plan: Plan;
  status: string;
  state: AccountPeriodState;
  billing_interval: BillingInterval | null;
  current_period_start: string | null;
  current_period_end: string | null;
  cancel_at_period_end: boolean;
  in_grace: boolean;
  trial: FreeTrialInfo | null;
  countdown: Countdown | null;
}

export const billingApi = {
  listPlans: async (): Promise<{ plans: Record<PlanId, Plan>; intervals: Record<BillingInterval, BillingIntervalInfo> }> => {
    const res = await api.get<PlansResponse>("/billing/plans");
    return { plans: res.plans, intervals: res.intervals };
  },

  getSubscription: () => api.get<Subscription>("/billing/subscription"),

  checkout: async (planId: PlanId, interval: BillingInterval = "monthly"): Promise<{ url: string }> => {
    const res = await api.post<{ checkout_url: string }>("/billing/checkout", { plan_id: planId, interval });
    return { url: res.checkout_url };
  },

  openPortal: async (): Promise<{ url: string }> => {
    const res = await api.post<{ portal_url: string }>("/billing/portal");
    return { url: res.portal_url };
  },
};
