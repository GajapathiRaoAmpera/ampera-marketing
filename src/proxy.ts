import { NextRequest, NextResponse } from "next/server";
import { SESSION_COOKIE } from "@/lib/auth/session";

// verify-email/forgot-password/reset-password must be reachable by a
// logged-OUT visitor (they're clicking a link from an email, or recovering
// access precisely because they can't log in), these were missing here
// entirely, so every such link 307'd straight to /login before the page
// ever rendered.
const PUBLIC_PATHS = ["/login", "/register", "/checkout/whatsapp", "/verify-email", "/forgot-password", "/reset-password"];

// Public paths a caller with an existing (possibly stale) session must
// still be allowed to complete, rather than being bounced to /dashboard
// before the page renders, e.g. finishing a password reset or confirming
// an email-verify link while an old session cookie happens to still be set.
const ALLOW_EVEN_WHEN_LOGGED_IN = ["/checkout/whatsapp", "/verify-email", "/reset-password"];

export function proxy(req: NextRequest) {
  const { pathname } = req.nextUrl;
  const hasSession = Boolean(req.cookies.get(SESSION_COOKIE)?.value);
  const isPublicPath = PUBLIC_PATHS.some((p) => pathname === p || pathname.startsWith(`${p}/`));
  const allowedWhenLoggedIn = ALLOW_EVEN_WHEN_LOGGED_IN.some((p) => pathname === p || pathname.startsWith(`${p}/`));

  if (!hasSession && !isPublicPath) {
    const loginUrl = new URL("/login", req.url);
    loginUrl.searchParams.set("next", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (hasSession && isPublicPath && !allowedWhenLoggedIn) {
    return NextResponse.redirect(new URL("/dashboard", req.url));
  }

  return NextResponse.next();
}

export const config = {
  // Static images (the logo, app icons) must load on the logged-out login page too.
  matcher: ["/((?!api|_next/static|_next/image|favicon.ico|.*\\.(?:png|ico|svg|jpg|jpeg|webp)$).*)"],
};
