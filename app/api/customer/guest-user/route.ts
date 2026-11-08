import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/customer/guest-user
// body: { name?, phone?, email? }
// EC注文でLINE未ログインのゲストがカード決済に進む際、PAY.JPのカード登録・3DS・
// 課金が users.id に紐づく設計のため、決済専用の軽量な users 行を作成する。
export async function POST(req: NextRequest) {
  try {
    const { name, phone, email } = await req.json();

    const { data, error } = await supabaseAdmin
      .from("users")
      .insert({
        user_type: "customer",
        status: "active",
        name: (name || "").trim() || "ゲスト",
        phone: phone || null,
        email: email || null,
      })
      .select("id")
      .single();

    if (error || !data) {
      console.error("[guest-user] 作成エラー:", error);
      return NextResponse.json({ error: "ユーザー作成に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ userId: data.id });
  } catch (e) {
    console.error("[guest-user] 例外:", e);
    return NextResponse.json({ error: "ユーザー作成に失敗しました" }, { status: 500 });
  }
}
