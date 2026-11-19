import { NextRequest, NextResponse } from "next/server";
import { getSessionToken } from "@/lib/auth/session";
import { backendHeaders, isSafeSegment, isSameSiteRequest } from "@/lib/server/backend";

const BACKEND_URL = process.env.BACKEND_URL ?? "http://localhost:8000";

// Every request through this proxy is user- and auth-scoped (it forwards a
// per-session Bearer token), Next.js must never cache or statically render
// this route.
export const dynamic = "force-dynamic";
// Full website scans can render several JavaScript routes before returning.
export const maxDuration = 300;

// Generic authenticated proxy: client components call `/api/backend/...`
// so the JWT (httpOnly cookie) never has to be exposed to client JS. This
// route reads the cookie server-side and attaches it as a Bearer header
// before forwarding to the real FastAPI backend.
async function proxy(req: NextRequest, path: string[]) {
  // A change must come from this site itself (see isSameSiteRequest), and the address must stay inside the API.
  if (!isSameSiteRequest(req)) {
    return NextResponse.json({ detail: "Request blocked." }, { status: 403 });
  }
  if (path.length === 0 || !path.every(isSafeSegment) || ["docs", "redoc", "openapi.json"].includes(path[0])) {
    return NextResponse.json({ detail: "Not found." }, { status: 404 });
  }
  const token = await getSessionToken();
  const targetUrl = `${BACKEND_URL}/${path.map(encodeURIComponent).join("/")}${req.nextUrl.search}`;

  const headers = new Headers(backendHeaders(req));
  const contentType = req.headers.get("content-type");
  if (contentType) headers.set("content-type", contentType);
  if (token) headers.set("Authorization", `Bearer ${token}`);
  // Which business the user is working in (see lib/api/active-business.ts).
  const businessId = req.headers.get("x-business-id");
  if (businessId) headers.set("X-Business-Id", businessId);

  const hasBody = !["GET", "HEAD"].includes(req.method);

  const response = await fetch(targetUrl, {
    method: req.method,
    headers,
    body: hasBody ? await req.arrayBuffer() : undefined,
    // FastAPI backend, not the browser: no credentials needed here.
    redirect: "manual",
    // Next.js's fetch() Data Cache applies inside Route Handlers too, not just
    // Server Components. Without this, GETs proxied through here (e.g. the
    // inbox's polled /dashboard/conversations and .../messages) get cached
    // after their first hit and never see new data again, even though the
    // real backend is returning fresh results on every request.
    cache: "no-store",
  });

  const responseHeaders = new Headers();
  const respContentType = response.headers.get("content-type");
  if (respContentType) responseHeaders.set("content-type", respContentType);
  // An account's responses are private: never stored by a shared cache.
  responseHeaders.set("cache-control", "no-store");
  const retryAfter = response.headers.get("retry-after");
  if (retryAfter) responseHeaders.set("retry-after", retryAfter);
  // Preserve redirects (e.g. Instagram's login/start) so the browser actually
  // navigates to Meta's OAuth dialog instead of silently losing the target.
  const location = response.headers.get("location");
  if (location) responseHeaders.set("location", location);

  const body = await response.arrayBuffer();
  return new NextResponse(body, { status: response.status, headers: responseHeaders });
}

export async function GET(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function POST(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function PATCH(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function PUT(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
export async function DELETE(req: NextRequest, { params }: { params: Promise<{ path: string[] }> }) {
  return proxy(req, (await params).path);
}
