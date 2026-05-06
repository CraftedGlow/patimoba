import { NextRequest, NextResponse } from "next/server";
import { payjpGet } from "@/lib/payjp";

// GET /api/payjp/check-3ds?token_id=tok_xxx
// PAY.JP トークンを取得して 3DS が必要かどうか返す
export async function GET(req: NextRequest) {
  const token_id = req.nextUrl.searchParams.get("token_id");

  if (!token_id) {
    return NextResponse.json({ error: "token_id は必須です" }, { status: 400 });
  }

  const res = await payjpGet(`/tokens/${token_id}`);
  const data = await res.json();

  console.log("[check-3ds] token:", token_id, "response:", JSON.stringify(data));

  if (!res.ok) {
    return NextResponse.json({ error: data.error }, { status: res.status });
  }

  // three_d_secure_status が "unverified" → 3DS 必要
  const status = data?.card?.three_d_secure_status ?? null;
  const needs3ds = status === "unverified";

  return NextResponse.json({ needs3ds, three_d_secure_status: status });
}
