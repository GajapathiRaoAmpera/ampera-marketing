import { NextRequest, NextResponse } from "next/server";
import { authApi, ApiError } from "@/lib/api";
import { setSession } from "@/lib/auth/session";
import { backendHeaders, isSameSiteRequest } from "@/lib/server/backend";

export async function POST(req: NextRequest) {
  if (!isSameSiteRequest(req)) {
    return NextResponse.json({ message: "Request blocked." }, { status: 403 });
  }
  try {
    const { idToken } = await req.json();
    const auth = await authApi.oauth("google", { idToken }, backendHeaders(req));
    const user = { user_id: auth.user_id, name: auth.name, email: auth.email, role: auth.role, email_verified: auth.email_verified, timezone: auth.timezone, is_platform_admin: auth.is_platform_admin };
    await setSession(auth.access_token, user);
    return NextResponse.json(user);
  } catch (err) {
    if (err instanceof ApiError) {
      return NextResponse.json({ message: err.userMessage }, { status: err.status });
    }
    return NextResponse.json({ message: "Something went wrong. Please try again." }, { status: 500 });
  }
}
