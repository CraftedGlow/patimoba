import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { payjpPost } from "@/lib/payjp";
import { authorizeUserAccess } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/payjp/create-customer
// body: { card: "<payjp_token>", user_id, tds_finish_url?: string }
export async function POST(req: NextRequest) {
  try {
    const { card, user_id, tds_finish_url } = await req.json();

    if (!card || !user_id) {
      return NextResponse.json({ error: "card トークンと user_id は必須です" }, { status: 400 });
    }

    const access = await authorizeUserAccess(req, supabaseAdmin, user_id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // 作成した顧客がどのユーザーのものかを後から検証できるよう metadata に紐付ける
    const params: Record<string, string> = { card, "metadata[user_id]": user_id };
    if (tds_finish_url) params.tds_finish_url = tds_finish_url;

    const res = await payjpPost("/customers", params);
    const data = await res.json();

    if (!res.ok) {
      console.error("[create-customer] PAY.JP エラー:", data?.error?.code ?? res.status);
      return NextResponse.json({ error: data.error }, { status: res.status });
    }

    // tds_id は customer 直下 or カードオブジェクト内、または tds_url から抽出
    const tdsUrl: string | null =
      data.tds_url ?? data.cards?.data?.[0]?.tds_url ?? null;
    const tdsIdFromUrl = tdsUrl?.match(/\/tds\/([^/?]+)/)?.[1] ?? null;
    const tdsId: string | null =
      data.tds_id ?? data.cards?.data?.[0]?.tds_id ?? tdsIdFromUrl ?? null;

    return NextResponse.json({ customerId: data.id, tdsUrl, tdsId });
  } catch (e) {
    console.error("[create-customer] 例外:", e);
    return NextResponse.json({ error: "顧客作成に失敗しました" }, { status: 500 });
  }
}
