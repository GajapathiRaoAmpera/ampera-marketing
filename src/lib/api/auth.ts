import { api } from "./client";
import type { AuthResponse } from "@/types/api";

// GET /users/me returns the bare user document with `_id` renamed to `id`
// (NOT `user_id` like register/login).
interface MeResponse {
  id: string;
  name: string;
  email: string;
  role: string;
  avatar_url?: string | null;
  [key: string]: unknown;
}

// PATCH /users/me does NOT return the full updated user - just
// {success, updated} where `updated` is the partial diff that was applied.
interface UpdateMeResponse {
  success: boolean;
  updated: Record<string, unknown>;
}

function detectTimezone(): string | undefined {
  try {
    return Intl.DateTimeFormat().resolvedOptions().timeZone;
  } catch {
    return undefined;
  }
}

export const authApi = {
  register: (input: { name: string; email: string; password: string }, headers?: Record<string, string>) =>
    api.post<AuthResponse>("/users/register", { ...input, timezone: detectTimezone() }, { headers }),

  login: (input: { email: string; password: string }, headers?: Record<string, string>) =>
    api.post<AuthResponse>("/users/login", input, { headers }),

  // Social login: "facebook" via a server-side redirect flow's authorization
  // code (redirectUri must be byte-for-byte identical to the one sent in
  // the original facebook.com/dialog/oauth request), "google" via a Google
  // Identity Services ID token - only one of code/idToken is set depending
  // on the provider.
  oauth: (provider: string, params: { code?: string; idToken?: string; redirectUri?: string }, headers?: Record<string, string>) =>
    api.post<AuthResponse>(
      `/users/oauth/${provider}`,
      { code: params.code, id_token: params.idToken, redirect_uri: params.redirectUri },
      { headers }
    ),

  me: (token?: string) => api.get<MeResponse>("/users/me", { token }),

  updateMe: (input: { name?: string; role?: string; avatar_url?: string; timezone?: string }, token?: string) =>
    api.patch<UpdateMeResponse>("/users/me", input, { token }),

  changePassword: (input: { current_password: string; new_password: string }) =>
    api.post<{ success: boolean; message: string; signed_out?: boolean }>("/users/me/change-password", input),

  verifyEmail: (token: string) => api.post<{ success: boolean; message: string }>("/users/verify-email", { token }),

  resendVerification: () => api.post<{ success: boolean; message: string }>("/users/resend-verification"),

  // Always resolves with the same generic {success, message} regardless of
  // whether the email exists, belongs to an OAuth-only account, or the send
  // actually succeeded - the backend deliberately never distinguishes these
  // (account-enumeration protection), so the UI must show one neutral
  // message for every outcome, not branch on it.
  forgotPassword: (email: string) => api.post<{ success: boolean; message: string }>("/users/forgot-password", { email }),

  resetPassword: (input: { token: string; new_password: string }) =>
    api.post<{ success: boolean; message: string }>("/users/reset-password", input),

  deleteAccount: () => api.delete<{ success: boolean; message: string }>("/users/me"),
};
