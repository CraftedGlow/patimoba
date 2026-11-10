import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { payjpPost } from "@/lib/payjp";
import { authorizeUserAccess } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/payjp/initiate-card-3ds
// body: { token_id, user_id }
// customer 作成 → three_d_secure_requests 作成 → tdsrId を返す
export async function POST(req: NextRequest) {
  try {
    const { token_id, user_id } = await req.json();

    if (!token_id || !user_id) {
      return NextResponse.json({ error: "token_id と user_id は必須です" }, { status: 400 });
    }

    const access = await authorizeUserAccess(req, supabaseAdmin, user_id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // 1. カスタマー作成（complete-card-3ds で本人の顧客か検証できるよう metadata に user_id を紐付ける）
    const cusRes = await payjpPost("/customers", { card: token_id, "metadata[user_id]": user_id });
    const cusData = await cusRes.json();
    if (!cusRes.ok) {
      console.error("[initiate-card-3ds] customer 作成エラー:", cusData?.error?.code ?? cusRes.status);
      return NextResponse.json({ error: cusData.error }, { status: cusRes.status });
    }

    const customerId: string = cusData.id;
    const cardId: string | undefined = cusData.cards?.data?.[0]?.id;

    if (!cardId) {
      return NextResponse.json({ error: "カード情報が取得できませんでした" }, { status: 500 });
    }

    // 2. カードに対する 3DS リクエスト作成
    const tdsrRes = await payjpPost("/three_d_secure_requests", { resource_id: cardId });
    const tdsrData = await tdsrRes.json();

    if (!tdsrRes.ok) {
      console.error("[initiate-card-3ds] TDS リクエスト作成エラー:", tdsrData?.error?.code ?? tdsrRes.status);
      return NextResponse.json({ error: tdsrData.error }, { status: tdsrRes.status });
    }

    return NextResponse.json({ customerId, tdsrId: tdsrData.id });
  } catch (e) {
    console.error("[initiate-card-3ds] 例外:", e);
    return NextResponse.json({ error: "3DS 開始処理に失敗しました" }, { status: 500 });
  }
}
