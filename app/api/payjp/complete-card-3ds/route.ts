import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { payjpGet } from "@/lib/payjp";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/payjp/complete-card-3ds
// body: { tdsr_id, customer_id, user_id? }
// 3DS 結果確認 → DB 保存
export async function POST(req: NextRequest) {
  try {
    const { tdsr_id, customer_id, user_id } = await req.json();

    if (!tdsr_id || !customer_id) {
      return NextResponse.json({ error: "tdsr_id と customer_id は必須です" }, { status: 400 });
    }

    // 3DS リクエストの結果を確認
    const verifyRes = await payjpGet(`/three_d_secure_requests/${tdsr_id}`);
    const verifyData = await verifyRes.json();
    console.log("[complete-card-3ds] verify:", JSON.stringify(verifyData));

    if (!verifyRes.ok) {
      return NextResponse.json({ error: verifyData.error }, { status: verifyRes.status });
    }

    const tdsStatus = verifyData.three_d_secure_status ?? verifyData.state;
    if (tdsStatus !== "verified" && verifyData.state !== "finished") {
      console.warn("[complete-card-3ds] 3DS 未完了:", tdsStatus, verifyData.state);
      return NextResponse.json(
        { error: "3Dセキュア認証が完了していません" },
        { status: 400 }
      );
    }

    // DB に customer_id を保存
    if (user_id) {
      const { error: dbError } = await supabaseAdmin
        .from("users")
        .update({ customer_id })
        .eq("id", user_id);

      if (dbError) {
        console.error("[complete-card-3ds] DB 保存エラー:", dbError);
        return NextResponse.json(
          { error: "DB への保存に失敗しました: " + dbError.message },
          { status: 500 }
        );
      }
    }

    return NextResponse.json({ success: true, customerId: customer_id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "3DS 完了処理に失敗しました";
    console.error("[complete-card-3ds] 例外:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
