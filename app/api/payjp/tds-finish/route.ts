import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { payjpPost } from "@/lib/payjp";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/payjp/tds-finish
// body: { customer_id, user_id?, skip_tds_finish? }
export async function POST(req: NextRequest) {
  try {
    const { customer_id, user_id, skip_tds_finish } = await req.json();

    if (!customer_id) {
      return NextResponse.json({ error: "customer_id は必須です" }, { status: 400 });
    }

    let payjpData: Record<string, unknown> = {};

    if (!skip_tds_finish) {
      const res = await payjpPost(`/customers/${customer_id}/tds_finish`, {});
      payjpData = await res.json();

      if (!res.ok) {
        console.error("[tds-finish] PAY.JP tds_finish エラー:", payjpData);
        return NextResponse.json({ error: payjpData.error }, { status: res.status });
      }
    }

    // user_id が渡された場合は DB に顧客 ID を保存
    if (user_id) {
      const { error: dbError } = await supabaseAdmin
        .from("users")
        .update({ customer_id: customer_id })
        .eq("id", user_id);

      if (dbError) {
        console.error("[tds-finish] DB 保存エラー:", dbError);
        return NextResponse.json({ error: "DB への保存に失敗しました: " + dbError.message }, { status: 500 });
      }
    }

    return NextResponse.json(payjpData);
  } catch (e) {
    const message = e instanceof Error ? e.message : "3Dセキュア完了処理に失敗しました";
    console.error("[tds-finish] 例外:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
