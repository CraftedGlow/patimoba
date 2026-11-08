import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { payjpGet } from "@/lib/payjp";
import { authorizeUserAccess } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/payjp/check-3ds?token_id=tok_xxx&user_id=<users.id>
// PAY.JP トークンを取得して 3DS が必要かどうか返す
export async function GET(req: NextRequest) {
  const token_id = req.nextUrl.searchParams.get("token_id");
  const user_id = req.nextUrl.searchParams.get("user_id");

  if (!token_id || !user_id) {
    return NextResponse.json({ error: "token_id と user_id は必須です" }, { status: 400 });
  }

  // 認証されていない第三者が PAY.JP API を自由に叩けないよう、本人（またはゲスト行）に限定する
  const access = await authorizeUserAccess(req, supabaseAdmin, user_id);
  if (!access.ok) {
    return NextResponse.json({ error: access.error }, { status: access.status });
  }

  const res = await payjpGet(`/tokens/${token_id}`);
  const data = await res.json();

  if (!res.ok) {
    console.error("[check-3ds] token 取得エラー:", data?.error?.code ?? res.status);
    return NextResponse.json({ error: "トークンの確認に失敗しました" }, { status: res.status });
  }

  // three_d_secure_status が "unverified" → 3DS 必要
  const status = data?.card?.three_d_secure_status ?? null;
  const needs3ds = status === "unverified";

  return NextResponse.json({ needs3ds, three_d_secure_status: status });
}
