import { NextResponse } from "next/server";

// POST /api/customer/takeout-order/finalize（廃止）
// テイクアウト注文は、会計画面がRLS経由で作成した注文をこのAPIで確定する方式から、
// /api/customer/takeout-order がDB上の価格から金額を再計算して作成・確定する方式に変わった。
// 更新前の画面を開いたままのお客様が、クライアント申告の金額のまま注文・課金されないよう、
// 何もせずにエラーを返す（未確定の注文は店舗側に表示されない）。
export async function POST() {
  return NextResponse.json(
    { error: "アプリが更新されました。お手数ですがページを再読み込みしてから、もう一度ご注文ください。" },
    { status: 410 }
  );
}
