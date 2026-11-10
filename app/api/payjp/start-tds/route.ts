import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import jwt from "jsonwebtoken";
import { authorizeUserAccess } from "@/lib/api-auth";
import { signTdsCallbackUid, isSafeReturnPath } from "@/lib/payjp";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/payjp/start-tds
// body: { token_id, user_id, return_path }
// 1. pending_tds_token を DB に保存
// 2. back_url を JWS (HS256) で署名
// 3. 3DS 開始 URL を返す
export async function POST(req: NextRequest) {
  try {
    const { token_id, user_id, return_path } = await req.json();

    if (!token_id || !user_id) {
      return NextResponse.json({ error: "token_id と user_id は必須です" }, { status: 400 });
    }

    // 他人の pending_tds_token を書き換え、3DS コールバック経由で他人の customer_id を
    // 上書きできないよう、本人（またはゲスト行）に限定する
    const access = await authorizeUserAccess(req, supabaseAdmin, user_id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const { error: dbError } = await supabaseAdmin
      .from("users")
      .update({ pending_tds_token: token_id })
      .eq("id", user_id);

    if (dbError) {
      console.error("[start-tds] DB 保存エラー:", dbError);
      return NextResponse.json({ error: "3Dセキュア開始に失敗しました" }, { status: 500 });
    }

    const host = req.headers.get("host") ?? "localhost:3000";
    const proto = host.startsWith("localhost") ? "http" : "https";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;
    const rp = isSafeReturnPath(return_path) ? return_path : "/customer/ec/confirm";
    // uid の署名（sig）を付け、コールバックを他ユーザー向けに偽造できないようにする
    const callbackUrl =
      `${siteUrl}/api/payjp/tds-callback` +
      `?uid=${encodeURIComponent(user_id)}` +
      `&sig=${signTdsCallbackUid(user_id)}` +
      `&rp=${encodeURIComponent(rp)}`;

    const secretKey = process.env.PAYJP_SECRET_KEY!;
    const jws = jwt.sign({ url: callbackUrl }, secretKey, { algorithm: "HS256" });

    const publicKey = process.env.NEXT_PUBLIC_PAYJP_PUBLIC_KEY!;
    const tdsStartUrl =
      `https://api.pay.jp/v1/tds/${token_id}/start` +
      `?publickey=${encodeURIComponent(publicKey)}` +
      `&back_url=${encodeURIComponent(jws)}`;

    return NextResponse.json({ redirectUrl: tdsStartUrl });
  } catch (e) {
    console.error("[start-tds] 例外:", e);
    return NextResponse.json({ error: "3DS 開始処理に失敗しました" }, { status: 500 });
  }
}
