import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { payjpGet } from "@/lib/payjp";
import { authorizeUserAccess } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/payjp/complete-card-3ds
// body: { tdsr_id, customer_id, user_id }
// 3DS 結果確認 → DB 保存
export async function POST(req: NextRequest) {
  try {
    const { tdsr_id, customer_id, user_id } = await req.json();

    if (!tdsr_id || !customer_id || !user_id) {
      return NextResponse.json({ error: "tdsr_id, customer_id, user_id は必須です" }, { status: 400 });
    }

    const access = await authorizeUserAccess(req, supabaseAdmin, user_id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // クライアント申告の customer_id をそのまま保存すると他人の PAY.JP 顧客を
    // 自分のアカウントに紐付けて課金できてしまうため、
    // initiate-card-3ds でこのユーザー用に作成した顧客であることを metadata で確認する
    const cusRes = await payjpGet(`/customers/${customer_id}`);
    const cusData = await cusRes.json();
    if (!cusRes.ok || cusData?.metadata?.user_id !== user_id) {
      return NextResponse.json({ error: "カード情報を確認できませんでした" }, { status: 403 });
    }

    // 3DS リクエストの結果を確認
    const verifyRes = await payjpGet(`/three_d_secure_requests/${tdsr_id}`);
    const verifyData = await verifyRes.json();

    if (!verifyRes.ok) {
      console.error("[complete-card-3ds] tdsr 取得エラー:", verifyData?.error?.code ?? verifyRes.status);
      return NextResponse.json({ error: "3Dセキュア認証の確認に失敗しました" }, { status: verifyRes.status });
    }

    // 3DS の対象カードがこの顧客のカードであること
    const resourceId: string | undefined = verifyData.resource_id;
    const cardRes = resourceId ? await payjpGet(`/customers/${customer_id}/cards/${resourceId}`) : null;
    if (!cardRes?.ok) {
      return NextResponse.json({ error: "カード情報を確認できませんでした" }, { status: 403 });
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
    const { error: dbError } = await supabaseAdmin
      .from("users")
      .update({ customer_id })
      .eq("id", user_id);

    if (dbError) {
      console.error("[complete-card-3ds] DB 保存エラー:", dbError);
      return NextResponse.json({ error: "カード情報の保存に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ success: true, customerId: customer_id });
  } catch (e) {
    console.error("[complete-card-3ds] 例外:", e);
    return NextResponse.json({ error: "3DS 完了処理に失敗しました" }, { status: 500 });
  }
}
