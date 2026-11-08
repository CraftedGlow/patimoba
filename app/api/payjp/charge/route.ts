import { NextResponse } from "next/server";

// POST /api/payjp/charge（廃止）
// 課金は注文作成と同時にサーバー側で行う（/api/ec/create-order, /api/customer/takeout-order）。
// クライアントが金額を指定して先に課金するこの API は、課金だけ成功して注文が作られない状態を生むため廃止した。
// 更新前の画面を開いたままのお客様が課金だけされないよう、課金せずにエラーを返す。
export async function POST() {
  return NextResponse.json(
    { error: "アプリが更新されました。お手数ですがページを再読み込みしてから、もう一度ご注文ください。" },
    { status: 410 }
  );
}
