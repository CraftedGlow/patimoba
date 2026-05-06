import { NextRequest, NextResponse } from "next/server";
import { payjpPost } from "@/lib/payjp";

// POST /api/payjp/initiate-card-3ds
// body: { token_id }
// customer 作成 → three_d_secure_requests 作成 → tdsrId を返す
export async function POST(req: NextRequest) {
  try {
    const { token_id } = await req.json();

    if (!token_id) {
      return NextResponse.json({ error: "token_id は必須です" }, { status: 400 });
    }

    // 1. カスタマー作成
    const cusRes = await payjpPost("/customers", { card: token_id });
    const cusData = await cusRes.json();
    if (!cusRes.ok) {
      console.error("[initiate-card-3ds] customer 作成エラー:", cusData);
      return NextResponse.json({ error: cusData.error }, { status: cusRes.status });
    }

    const customerId: string = cusData.id;
    const cardId: string | undefined = cusData.cards?.data?.[0]?.id;

    console.log("[initiate-card-3ds] customerId:", customerId, "cardId:", cardId);

    if (!cardId) {
      return NextResponse.json({ error: "カード情報が取得できませんでした" }, { status: 500 });
    }

    // 2. カードに対する 3DS リクエスト作成
    const tdsrRes = await payjpPost("/three_d_secure_requests", { resource_id: cardId });
    const tdsrData = await tdsrRes.json();
    console.log("[initiate-card-3ds] three_d_secure_requests:", JSON.stringify(tdsrData));

    if (!tdsrRes.ok) {
      console.error("[initiate-card-3ds] TDS リクエスト作成エラー:", tdsrData);
      return NextResponse.json({ error: tdsrData.error }, { status: tdsrRes.status });
    }

    return NextResponse.json({ customerId, tdsrId: tdsrData.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "3DS 開始処理に失敗しました";
    console.error("[initiate-card-3ds] 例外:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
