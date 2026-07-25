import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/customer/profile?userId=<users.id>
// EC決済のゲストユーザーは auth_user_id を持たず、RLS(auth_user_id = auth.uid()) で
// クライアントから直接 users テーブルを読めないため、service role 経由で取得する。
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const userId = searchParams.get("userId");

    if (!userId) {
      return NextResponse.json({ error: "userId は必須です" }, { status: 400 });
    }

    const { data, error } = await supabaseAdmin
      .from("users")
      .select("name, name_kana, phone, email, customer_id")
      .eq("id", userId)
      .maybeSingle();

    if (error) {
      return NextResponse.json({ error: error.message }, { status: 500 });
    }

    return NextResponse.json({ profile: data });
  } catch (e) {
    const message = e instanceof Error ? e.message : "プロフィール取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
