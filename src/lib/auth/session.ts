import { cookies } from "next/headers";
import type { AuthUser } from "@/types/api";

export const SESSION_COOKIE = "session_token";
export const USER_COOKIE = "session_user";

const isProd = process.env.NODE_ENV === "production";

export async function setSession(accessToken: string, user: AuthUser) {
  const store = await cookies();
  const maxAge = Number(process.env.JWT_EXPIRATION_SECONDS ?? 60 * 60 * 24);

  store.set(SESSION_COOKIE, accessToken, {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge,
  });

  // Non-sensitive display info only - never put the token here.
  store.set(USER_COOKIE, JSON.stringify(user), {
    httpOnly: true,
    secure: isProd,
    sameSite: "lax",
    path: "/",
    maxAge,
  });
}

export async function clearSession() {
  const store = await cookies();
  store.delete(SESSION_COOKIE);
  store.delete(USER_COOKIE);
}

export async function getSessionToken(): Promise<string | undefined> {
  const store = await cookies();
  return store.get(SESSION_COOKIE)?.value;
}

export async function getSessionUser(): Promise<AuthUser | null> {
  const store = await cookies();
  const raw = store.get(USER_COOKIE)?.value;
  if (!raw) return null;
  try {
    return JSON.parse(raw) as AuthUser;
  } catch {
    return null;
  }
}
