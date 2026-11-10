import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { payjpGet } from "@/lib/payjp";
import { authorizeUserAccess } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/payjp/cards?userId=<users.id>
// pay.jp カード情報取得: GET https://api.pay.jp/v1/customers/{id}/cards
// 任意の customer_id を受け取ると他人のカード情報を覗けてしまうため、
// 呼び出し元本人（またはゲスト行）の users.customer_id だけを参照する。
export async function GET(req: NextRequest) {
  try {
    const userId = req.nextUrl.searchParams.get("userId");
    if (!userId) {
      return NextResponse.json({ error: "userId は必須です" }, { status: 400 });
    }

    const access = await authorizeUserAccess(req, supabaseAdmin, userId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("customer_id")
      .eq("id", userId)
      .maybeSingle();
    if (!user?.customer_id) {
      return NextResponse.json({ data: [] });
    }

    const res = await payjpGet(`/customers/${user.customer_id}/cards`);
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: "カード情報取得に失敗しました" }, { status: res.status });
    }

    // 表示に必要な項目だけ返す
    const cards = (data.data ?? []).map((c: any) => ({
      id: c.id,
      brand: c.brand,
      last4: c.last4,
      exp_month: c.exp_month,
      exp_year: c.exp_year,
    }));
    return NextResponse.json({ data: cards });
  } catch (e) {
    console.error("[payjp/cards] 例外:", e);
    return NextResponse.json({ error: "カード情報取得に失敗しました" }, { status: 500 });
  }
}
