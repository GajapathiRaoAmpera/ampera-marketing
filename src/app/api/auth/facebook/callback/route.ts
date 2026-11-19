import { NextRequest, NextResponse } from "next/server";
import { authApi, ApiError } from "@/lib/api";
import { setSession } from "@/lib/auth/session";

// Meta redirects the browser here after the user authorizes on
// facebook.com/dialog/oauth (see SocialLoginButtons.tsx): a real,
// server-side redirect flow, not the JS SDK popup (which hits an
// undocumented FedCM NetworkError as of this writing). This route runs
// server-side so it can set the httpOnly session cookie directly, then
// bounces the browser into the app, mirroring the POST handler in
// ../route.ts, just triggered by a GET redirect instead of a client fetch.
export async function GET(req: NextRequest) {
  const code = req.nextUrl.searchParams.get("code");
  const error = req.nextUrl.searchParams.get("error");

  if (error || !code) {
    return NextResponse.redirect(new URL("/login?error=facebook", req.url));
  }

  try {
    // Must be byte-for-byte identical to what SocialLoginButtons.tsx sent as
    // redirect_uri in the original dialog/oauth request: this route's own
    // absolute URL (path only, no query string) is exactly that value.
    const redirectUri = new URL("/api/auth/facebook/callback", req.url).toString();
    const auth = await authApi.oauth("facebook", { code, redirectUri });
    const user = {
      user_id: auth.user_id,
      name: auth.name,
      email: auth.email,
      role: auth.role,
      email_verified: auth.email_verified,
      timezone: auth.timezone,
      is_platform_admin: auth.is_platform_admin,
    };
    await setSession(auth.access_token, user);
    return NextResponse.redirect(new URL("/", req.url));
  } catch (err) {
    const message = err instanceof ApiError ? err.userMessage : "facebook";
    return NextResponse.redirect(new URL(`/login?error=${encodeURIComponent(message)}`, req.url));
  }
}
