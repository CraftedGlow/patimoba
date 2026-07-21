import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { payjpPost } from "@/lib/payjp";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// GET /api/payjp/tds-callback?uid=<user_id>&rp=<return_path>
// PAY.JP リダイレクト型 3DS のコールバックエンドポイント
// tds_finish → Customer 作成 → DB 保存 → 確認ページへリダイレクト
export async function GET(req: NextRequest) {
  const { searchParams } = req.nextUrl;
  const userId = searchParams.get("uid");
  const returnPath = searchParams.get("rp") ?? "/customer/ec/confirm";

  const errorRedirect = (msg: string) =>
    NextResponse.redirect(
      new URL(`/customer/payment/card?tds_error=${encodeURIComponent(msg)}`, req.url)
    );

  if (!userId) {
    return errorRedirect("ユーザー情報が見つかりません");
  }

  try {
    // 1. pending_tds_token を DB から取得
    const { data: user, error: userErr } = await supabaseAdmin
      .from("users")
      .select("pending_tds_token")
      .eq("id", userId)
      .maybeSingle();

    if (userErr || !user?.pending_tds_token) {
      console.error("[tds-callback] pending_tds_token 取得失敗:", userErr);
      return errorRedirect("セッション情報が見つかりません。最初からやり直してください。");
    }

    const tokenId = user.pending_tds_token;

    // 2. tds_finish
    const tdsRes = await payjpPost(`/tokens/${tokenId}/tds_finish`, {});
    const tdsData = await tdsRes.json();

    if (!tdsRes.ok) {
      console.error("[tds-callback] tds_finish エラー:", tdsData);
      return errorRedirect("3Dセキュア認証に失敗しました。もう一度お試しください。");
    }

    // 3. ステータス確認
    const status = tdsData.card?.three_d_secure_status;
    if (status !== "verified" && status !== "attempted") {
      console.error("[tds-callback] 3DS ステータス不正:", status);
      return errorRedirect("3Dセキュア認証が完了していません。もう一度お試しください。");
    }

    // 4. Customer 作成
    const cusRes = await payjpPost("/customers", { card: tokenId });
    const cusData = await cusRes.json();

    if (!cusRes.ok) {
      console.error("[tds-callback] customer 作成エラー:", cusData);
      return errorRedirect("カード登録に失敗しました。もう一度お試しください。");
    }

    // 5. DB 更新: customer_id 保存 + pending_tds_token クリア
    const { error: updateErr } = await supabaseAdmin
      .from("users")
      .update({ customer_id: cusData.id, pending_tds_token: null })
      .eq("id", userId);

    if (updateErr) {
      console.error("[tds-callback] DB 更新エラー:", updateErr);
      return errorRedirect("カード情報の保存に失敗しました。");
    }

    console.log("[tds-callback] 完了 customerId:", cusData.id, "→", returnPath);
    return NextResponse.redirect(new URL(returnPath, req.url));
  } catch (e) {
    console.error("[tds-callback] 例外:", e);
    return errorRedirect("処理中にエラーが発生しました。");
  }
}
