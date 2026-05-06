import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { payjpPost } from "@/lib/payjp";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/payjp/finalize-card
// body: { token_id, user_id?, skip_tds_finish? }
// 3DS 完了後に呼ぶ：tds_finish(verified) → customer 作成 → DB 保存
// checkout.js iframe ワークフローは tds_finish を内部処理済みのため skip_tds_finish: true を渡す
export async function POST(req: NextRequest) {
  try {
    const { token_id, user_id, skip_tds_finish } = await req.json();

    if (!token_id) {
      return NextResponse.json({ error: "token_id は必須です" }, { status: 400 });
    }

    // 1. tds_finish → トークンが verified になる（checkout.js iframe 完了済みの場合はスキップ）
    if (!skip_tds_finish) {
      const tdsRes = await payjpPost(`/tokens/${token_id}/tds_finish`, {});
      const tdsData = await tdsRes.json();
      if (!tdsRes.ok) {
        console.error("[finalize-card] token tds_finish エラー:", tdsData);
        return NextResponse.json({ error: tdsData.error }, { status: tdsRes.status });
      }
    }

    // 2. 顧客作成（3DS 済みトークンを使用）
    const cusRes = await payjpPost("/customers", { card: token_id });
    const cusData = await cusRes.json();
    if (!cusRes.ok) {
      console.error("[finalize-card] customer 作成エラー:", cusData);
      return NextResponse.json({ error: cusData.error }, { status: cusRes.status });
    }

    console.log("[finalize-card] customer 作成成功:", cusData.id);

    // 3. DB に customer_id を保存
    if (user_id) {
      const { error: dbError } = await supabaseAdmin
        .from("users")
        .update({ customer_id: cusData.id })
        .eq("id", user_id);

      if (dbError) {
        console.error("[finalize-card] DB 保存エラー:", dbError);
        return NextResponse.json({ error: "DB への保存に失敗しました: " + dbError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ customerId: cusData.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "カード登録の完了処理に失敗しました";
    console.error("[finalize-card] 例外:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
