import type { NextRequest } from "next/server";

/**
 * What this website's server adds when it calls the backend for a visitor.
 *
 * The backend sees every call arrive from this server, not from the visitor, so by itself it could not
 * tell visitors apart (one shared limit for everybody) or stop one of them guessing passwords. When
 * BACKEND_PROXY_SECRET is set (the same value as the backend's FRONTEND_PROXY_SECRET) the visitor's address
 * is sent along, and the backend believes it because only this server knows the secret.
 */
export function visitorAddress(req: NextRequest): string {
  const candidates = [
    req.headers.get("x-vercel-forwarded-for"),
    req.headers.get("x-real-ip"),
    req.headers.get("x-forwarded-for")?.split(",")[0],
  ];
  return (candidates.find((value) => value && value.trim()) ?? "").trim().slice(0, 64);
}

export function backendHeaders(req: NextRequest): Record<string, string> {
  const secret = process.env.BACKEND_PROXY_SECRET;
  if (!secret) return {};
  const headers: Record<string, string> = { "X-Proxy-Secret": secret };
  const ip = visitorAddress(req);
  if (ip) headers["X-Real-Client-IP"] = ip;
  return headers;
}

/**
 * Cross-site request forgery: a page on another site can make a signed-in visitor's browser send a
 * request here, cookie and all. Browsers say where a request came from; a change (anything but a read)
 * must come from this site itself.
 */
export function isSameSiteRequest(req: NextRequest): boolean {
  if (["GET", "HEAD", "OPTIONS"].includes(req.method)) return true;
  const fetchSite = req.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "none") return false;
  const host = req.headers.get("x-forwarded-host") ?? req.headers.get("host");
  const origin = req.headers.get("origin");
  if (origin) {
    try {
      return new URL(origin).host === host;
    } catch {
      return false;
    }
  }
  // No Origin: fine for same-origin fetches that omit it, so rely on Sec-Fetch-Site above; with neither
  // header present (an old browser or a script) a change is refused.
  return fetchSite === "same-origin" || fetchSite === "none";
}

/** A path segment that could climb out of the API address or smuggle in another. */
export function isSafeSegment(segment: string): boolean {
  return segment !== "" && segment !== "." && segment !== ".." && !/[\\/?#\u0000-\u001f]/.test(segment);
}
