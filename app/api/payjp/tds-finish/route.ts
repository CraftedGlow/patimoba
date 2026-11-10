import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { payjpPost } from "@/lib/payjp";
import { authorizeUserAccess } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/payjp/tds-finish
// body: { customer_id, user_id, skip_tds_finish? }
// 本人に登録済みの PAY.JP 顧客に対してのみ 3DS 完了処理を行う。
// クライアント申告の customer_id を users に保存することはしない
// （他人の顧客を自分のアカウントに紐付けて課金できてしまうため）。
export async function POST(req: NextRequest) {
  try {
    const { customer_id, user_id, skip_tds_finish } = await req.json();

    if (!customer_id || !user_id) {
      return NextResponse.json({ error: "customer_id と user_id は必須です" }, { status: 400 });
    }

    const access = await authorizeUserAccess(req, supabaseAdmin, user_id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { data: user } = await supabaseAdmin
      .from("users")
      .select("customer_id")
      .eq("id", user_id)
      .maybeSingle();
    if (!user?.customer_id || user.customer_id !== customer_id) {
      return NextResponse.json({ error: "カード情報を確認できませんでした" }, { status: 403 });
    }

    let payjpData: Record<string, unknown> = {};

    if (!skip_tds_finish) {
      const res = await payjpPost(`/customers/${customer_id}/tds_finish`, {});
      payjpData = await res.json();

      if (!res.ok) {
        console.error("[tds-finish] PAY.JP tds_finish エラー:", (payjpData.error as any)?.code ?? res.status);
        return NextResponse.json({ error: payjpData.error }, { status: res.status });
      }
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[tds-finish] 例外:", e);
    return NextResponse.json({ error: "3Dセキュア完了処理に失敗しました" }, { status: 500 });
  }
}
