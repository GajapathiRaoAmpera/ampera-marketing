import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

export async function GET(_request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const response = await fetch(`${BACKEND_URL}/public/commerce/checkout/${encodeURIComponent(token)}`, { cache: "no-store" });
  const body = await response.json().catch(() => ({ detail: "Checkout unavailable" }));
  return NextResponse.json(body, { status: response.status });
}

export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const body = await request.json();
  const response = await fetch(`${BACKEND_URL}/public/commerce/checkout/${encodeURIComponent(token)}/verify`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
  });
  const result = await response.json().catch(() => ({ detail: "Payment verification unavailable" }));
  return NextResponse.json(result, { status: response.status });
}
