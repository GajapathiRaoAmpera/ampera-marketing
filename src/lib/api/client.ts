import { ApiError } from "./errors";
import { getActiveBusinessHeader } from "./active-business";
import { mockFetch } from "@/lib/mock/router";

// Demo build: no backend. Every call is answered by the in-memory mock (lib/mock). Set
// NEXT_PUBLIC_DEMO_MODE=false to talk to a real backend again.
const DEMO_MODE = process.env.NEXT_PUBLIC_DEMO_MODE !== "false";

// Server-side calls (route handlers, middleware) hit the backend directly.
// Client-side calls go through our own /api/backend proxy (see
// app/api/backend/[...path]/route.ts) so the httpOnly auth cookie never has
// to be readable by JS - the proxy attaches the Bearer token server-side.
const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";
const isServer = typeof window === "undefined";

export interface RequestOptions extends Omit<RequestInit, "body"> {
  body?: unknown;
  /** Explicit bearer token, used only in server-side code (route handlers, middleware). */
  token?: string;
  /** Set true to send a FormData body as-is instead of JSON-encoding it. */
  isFormData?: boolean;
}

function buildUrl(path: string): string {
  if (isServer) {
    return `${BACKEND_URL}${path}`;
  }
  return `/api/backend${path}`;
}

async function parseBody(response: Response): Promise<unknown> {
  const contentType = response.headers.get("content-type") ?? "";
  if (contentType.includes("application/json")) {
    try {
      return await response.json();
    } catch {
      return null;
    }
  }
  return null;
}

export async function apiFetch<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { body, token, isFormData, headers, ...rest } = options;
  if (DEMO_MODE) return (await mockFetch(rest.method ?? "GET", path, body)) as T;

  const finalHeaders = new Headers(headers);
  if (!isFormData) {
    finalHeaders.set("Content-Type", "application/json");
  }
  if (token) {
    finalHeaders.set("Authorization", `Bearer ${token}`);
  }
  // Which business the user is working in. The backend uses it to run a team
  // member's request against the owner's data (and ignores it otherwise).
  const activeBusinessId = isServer ? null : getActiveBusinessHeader();
  if (activeBusinessId && !finalHeaders.has("X-Business-Id")) {
    finalHeaders.set("X-Business-Id", activeBusinessId);
  }

  const response = await fetch(buildUrl(path), {
    ...rest,
    credentials: isServer ? undefined : "include",
    headers: finalHeaders,
    body: body === undefined ? undefined : isFormData ? (body as FormData) : JSON.stringify(body),
  });

  if (!response.ok) {
    const parsed = await parseBody(response);
    const detail =
      parsed && typeof parsed === "object" && "detail" in (parsed as Record<string, unknown>)
        ? (parsed as Record<string, unknown>).detail
        : parsed;
    throw new ApiError(response.status, response.statusText, detail);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await parseBody(response)) as T;
}

export const api = {
  get: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: "GET" }),
  post: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "POST", body }),
  patch: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PATCH", body }),
  put: <T>(path: string, body?: unknown, options?: RequestOptions) =>
    apiFetch<T>(path, { ...options, method: "PUT", body }),
  delete: <T>(path: string, options?: RequestOptions) => apiFetch<T>(path, { ...options, method: "DELETE" }),
};

export { ApiError };
