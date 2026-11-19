import { api } from "./client";
import type { AccountPeriodState, BillingInterval, Countdown, FreeTrialInfo } from "./billing";
import type { InstagramCommentMetrics } from "./instagram-automations";

export interface AdminBusiness {
  id: string;
  name: string;
  agent_id: string | null;
  agent_status: string | null;
  user_id: string | null;
  owner_email: string | null;
  owner_name: string | null;
  owner_disabled: boolean;
  created_at: string;
}

interface AdminBusinessListResponse {
  businesses: AdminBusiness[];
  total: number;
}

export interface AdminMetrics {
  total_users: number;
  total_businesses: number;
  active_agents: number;
  paused_agents: number;
  messages_today: number;
  messages_week: number;
  messages_month: number;
}

export interface AdminActivityItem {
  type: "audit" | "notification";
  id: string;
  user_id: string | null;
  business_id: string | null;
  action: string | null;
  summary: string | null;
  actor_role: string | null;
  created_at: string;
}

interface AdminActivityResponse {
  activity: AdminActivityItem[];
}

/** pending = on the hard trial tier until an admin approves the account. */
export type ApprovalStatus = "pending" | "approved";
/** expired = the free period is over and nothing paid is running: the account is locked until it subscribes. */
export type TierId = "trial" | "free" | "pro" | "enterprise" | "expired";
/** Plans an admin can put an approved account on. */
export type AssignablePlanId = Exclude<TierId, "trial" | "expired">;

/** An account's tier and countdowns, plus where its free-period length comes from. */
export interface AccountSubscription {
  plan_id: TierId;
  state: AccountPeriodState;
  approval_status: ApprovalStatus;
  billing_interval: BillingInterval | null;
  current_period_start: string | null;
  current_period_end: string | null;
  in_grace: boolean;
  trial: FreeTrialInfo | null;
  countdown: Countdown | null;
  /** Whose number the free-period length is: this account's own, the free plan's, the platform's, or the built-in default. */
  trial_days_source: "user" | "plan" | "global" | "default";
}

export interface AdminUser {
  id: string;
  name: string;
  email: string;
  role: string;
  email_verified: boolean;
  approval_status: ApprovalStatus;
  approved_at?: string | null;
  disabled: boolean;
  is_platform_admin: boolean;
  timezone?: string;
  created_at: string;
  business_count: number;
  /** The plan whose numbers apply right now. */
  plan_id: TierId;
  account_state?: AccountPeriodState;
  billing_interval?: BillingInterval | null;
  /** Time left in the free period or the paid cycle; null when neither has an end. */
  countdown?: Countdown | null;
}

interface AdminUserListResponse {
  users: AdminUser[];
  total: number;
}

export interface AdminUserBusiness {
  id: string;
  name: string;
  agent_id: string | null;
  agent_status: string | null;
  created_at: string;
}

export interface TokenUsage {
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  call_count: number;
}

export interface UsageMeter {
  used: number;
  /** null = unlimited */
  limit: number | null;
  remaining: number | null;
  period: string;
  /** Trial allowances last for the life of the account; others reset monthly. */
  lifetime: boolean;
}

export interface AccountUsage {
  ai_replies: UsageMeter;
  automated_replies: UsageMeter;
}

export interface AdminUserDetail extends AdminUser {
  businesses: AdminUserBusiness[];
  subscription: {
    plan_id: string;
    status: string;
    state: AccountPeriodState;
    subscription_plan_id: string | null;
    billing_interval: BillingInterval | null;
    current_period_start: string | null;
    current_period_end: string | null;
    in_grace: boolean;
    trial: FreeTrialInfo | null;
    countdown: Countdown | null;
  };
  usage: AccountUsage;
  messages_today: number;
  messages_week: number;
  messages_month: number;
  token_usage_month: TokenUsage;
}

export interface TokenUsageLeaderboardRow {
  user_id: string;
  email: string | null;
  name: string | null;
  input_tokens: number;
  output_tokens: number;
  total_tokens: number;
  call_count: number;
}

interface TokenUsageLeaderboardResponse {
  usage: TokenUsageLeaderboardRow[];
}

export interface AdminInstagramCommentRow extends InstagramCommentMetrics {
  connection_id: string;
  business_id: string | null;
  instagram_username: string | null;
}

export interface AdminInstagramCommentMetrics {
  period_days: number;
  totals: InstagramCommentMetrics & {
    /** Accounts with comment activity or comment automations. */
    accounts: number;
    /** Comments not yet tied to an account because they are still unprocessed. */
    unprocessed_unassigned: number;
  };
  /** Accounts with the most missed comments first. */
  accounts: AdminInstagramCommentRow[];
}

export type SettingType = "bool" | "int_or_null";
export type SettingCategory = "channel" | "limit" | "feature" | "rate";
export type SettingValue = boolean | number | null;

export interface SettingWithOverrides {
  key: string;
  type: SettingType;
  category: SettingCategory;
  label: string;
  description: string;
  default: SettingValue;
  effective_global: SettingValue;
  plan_overrides: Record<TierId, SettingValue>;
  /** What each plan actually gets; `custom` is false when it just follows the platform value. */
  plan_values: Record<TierId, { custom: boolean; value: SettingValue }>;
}

export interface AdminOverview {
  totals: {
    users: number;
    businesses: number;
    active_agents: number;
    paused_agents: number;
    pending_approvals: number;
  };
  messages: { today: number; week: number; month: number };
  plans: Record<Exclude<TierId, "expired">, number>;
  usage_this_month: { ai_replies: number; automated_replies: number };
  waiting_for_approval: Array<{
    id: string;
    name: string | null;
    email: string | null;
    created_at: string;
    email_verified: boolean;
    ai_replies_used: number;
    automated_replies_used: number;
  }>;
}

export type AccountStatusFilter = "pending" | "approved" | "disabled";

interface ListSettingsResponse {
  settings: SettingWithOverrides[];
}

export interface CreateSettingPayload {
  key: string;
  type: SettingType;
  category: SettingCategory;
  label: string;
  description?: string;
  default: SettingValue;
}

export interface SettingUserOverride {
  user_id: string;
  user_name: string | null;
  user_email: string | null;
  value: SettingValue;
  reason: string | null;
  updated_by: string | null;
  updated_at: string;
}

interface ListSettingOverridesResponse {
  overrides: SettingUserOverride[];
}

export interface UserEffectiveSetting {
  key: string;
  type: SettingType;
  category: SettingCategory;
  label: string;
  description: string;
  effective_value: SettingValue;
  source: "user" | "plan" | "global" | "default";
}

interface UserEffectiveSettingsResponse {
  settings: UserEffectiveSetting[];
}

export const adminApi = {
  listBusinesses: (skip = 0, limit = 50) =>
    api.get<AdminBusinessListResponse>(`/admin/businesses?skip=${skip}&limit=${limit}`),

  getBusiness: (businessId: string) => api.get<AdminBusiness>(`/admin/businesses/${businessId}`),

  getMetrics: () => api.get<AdminMetrics>("/admin/metrics"),

  getActivity: (limit = 50) => api.get<AdminActivityResponse>(`/admin/activity?limit=${limit}`),

  suspendBusiness: (businessId: string, reason: string) =>
    api.post<{ success: boolean; business_id: string; agent_status: string }>(
      `/admin/businesses/${businessId}/suspend`,
      { reason }
    ),

  disableUser: (userId: string, reason: string) =>
    api.post<{ success: boolean; user_id: string; disabled: boolean }>(`/admin/users/${userId}/disable`, { reason }),

  enableUser: (userId: string) =>
    api.post<{ success: boolean; user_id: string; disabled: boolean }>(`/admin/users/${userId}/enable`, {}),

  listUsers: (skip = 0, limit = 50, search?: string, status?: AccountStatusFilter) => {
    const params = new URLSearchParams({ skip: String(skip), limit: String(limit) });
    if (search) params.set("search", search);
    if (status) params.set("status", status);
    return api.get<AdminUserListResponse>(`/admin/users?${params.toString()}`);
  },

  getUser: (userId: string) => api.get<AdminUserDetail>(`/admin/users/${userId}`),

  getTokenUsageLeaderboard: (limit = 50) =>
    api.get<TokenUsageLeaderboardResponse>(`/admin/token-usage?limit=${limit}`),

  getInstagramCommentMetrics: (days = 7, limit = 50) =>
    api.get<AdminInstagramCommentMetrics>(`/admin/instagram-comments?days=${days}&limit=${limit}`),

  listSettings: async (): Promise<SettingWithOverrides[]> => {
    const res = await api.get<ListSettingsResponse>("/admin/settings");
    return res.settings;
  },

  createSetting: (payload: CreateSettingPayload) =>
    api.post<{ setting: SettingWithOverrides }>("/admin/settings", payload),

  updateGlobalSetting: (key: string, value: SettingValue, reason?: string) =>
    api.patch<{ success: boolean; key: string; value: SettingValue }>(`/admin/settings/${key}`, { value, reason }),

  /** Set a plan's value. `null` removes the plan's own value (it follows the platform value). */
  updatePlanSettingOverride: (key: string, planId: TierId, value: SettingValue, reason?: string) =>
    api.patch<{ success: boolean; key: string; plan_id: string; value: SettingValue }>(
      `/admin/settings/${key}/plans/${planId}`,
      { value, reason }
    ),

  /** Give a plan an explicit "no limit" for a number setting. */
  setPlanSettingUnlimited: (key: string, planId: TierId, reason?: string) =>
    api.patch<{ success: boolean; key: string; plan_id: string; value: SettingValue }>(
      `/admin/settings/${key}/plans/${planId}`,
      { value: null, unlimited: true, reason }
    ),

  getOverview: () => api.get<AdminOverview>("/admin/overview"),

  /** `trialDays` gives this account its own free-period length instead of the platform's. */
  approveUser: (userId: string, planId: AssignablePlanId, trialDays?: number) =>
    api.post<{ success: boolean; approval_status: ApprovalStatus; plan_id: TierId }>(
      `/admin/users/${userId}/approve`,
      { plan_id: planId, ...(trialDays !== undefined ? { trial_days: trialDays } : {}) }
    ),

  unapproveUser: (userId: string) =>
    api.post<{ success: boolean; approval_status: ApprovalStatus; plan_id: TierId }>(
      `/admin/users/${userId}/unapprove`,
      {}
    ),

  /** A paid plan with a `billingInterval` runs for one cycle from now and counts down; without one it has no end. */
  changePlan: (userId: string, planId: AssignablePlanId, billingInterval?: BillingInterval) =>
    api.put<{ success: boolean; plan_id: AssignablePlanId; plan_name: string | null; billing_interval: BillingInterval | null }>(
      `/admin/users/${userId}/plan`,
      { plan_id: planId, ...(billingInterval ? { billing_interval: billingInterval } : {}) }
    ),

  /** How long the free period lasts for everyone without a number of their own. `days: null` = it never ends. */
  getTrialDefault: () => api.get<{ days: number | null; source: "global" | "default" }>("/admin/trial"),

  setTrialDefault: (days: number | null) => api.put<{ success: boolean; days: number | null }>("/admin/trial", { days }),

  getUserSubscription: (userId: string) => api.get<AccountSubscription>(`/admin/users/${userId}/subscription`),

  /** Change one account's free period. Send at most one of days / unlimited / useDefault. */
  changeUserTrial: (
    userId: string,
    change: { days?: number; unlimited?: boolean; useDefault?: boolean; restart?: boolean }
  ) =>
    api.put<{ success: boolean } & AccountSubscription>(`/admin/users/${userId}/trial`, {
      days: change.days ?? null,
      unlimited: change.unlimited ?? false,
      use_default: change.useDefault ?? false,
      restart: change.restart ?? false,
    }),

  listSettingOverrides: async (key: string): Promise<SettingUserOverride[]> => {
    const res = await api.get<ListSettingOverridesResponse>(`/admin/settings/${key}/overrides`);
    return res.overrides;
  },

  setUserSettingOverride: (key: string, userId: string, value: SettingValue, reason?: string) =>
    api.put<{ success: boolean; key: string; user_id: string; value: SettingValue }>(
      `/admin/settings/${key}/users/${userId}`,
      { value, reason }
    ),

  removeUserSettingOverride: (key: string, userId: string) =>
    api.delete<{ success: boolean; key: string; user_id: string }>(`/admin/settings/${key}/users/${userId}`),

  getUserEffectiveSettings: async (userId: string): Promise<UserEffectiveSetting[]> => {
    const res = await api.get<UserEffectiveSettingsResponse>(`/admin/users/${userId}/settings`);
    return res.settings;
  },
};
