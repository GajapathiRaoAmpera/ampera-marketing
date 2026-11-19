import { NextRequest, NextResponse } from "next/server";

const BACKEND_URL = process.env.BACKEND_URL ?? process.env.NEXT_PUBLIC_API_BASE_URL ?? "http://localhost:8000";

// The customer says they've paid by UPI and sends their reference number.
export async function POST(request: NextRequest, context: { params: Promise<{ token: string }> }) {
  const { token } = await context.params;
  const body = await request.json().catch(() => ({}));
  const response = await fetch(`${BACKEND_URL}/public/commerce/checkout/${encodeURIComponent(token)}/upi-reference`, {
    method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(body), cache: "no-store",
  });
  const result = await response.json().catch(() => ({ detail: "Couldn't send your reference. Please try again." }));
  return NextResponse.json(result, { status: response.status });
}
