import { NextRequest, NextResponse } from "next/server";
import { payjpPost } from "@/lib/payjp";

// POST /api/payjp/create-customer
// body: { card: "<payjp_token>", tds_finish_url?: string }
export async function POST(req: NextRequest) {
  try {
    const { card, tds_finish_url } = await req.json();

    if (!card) {
      return NextResponse.json({ error: "card トークンは必須です" }, { status: 400 });
    }

    const params: Record<string, string> = { card };
    if (tds_finish_url) params.tds_finish_url = tds_finish_url;

    const res = await payjpPost("/customers", params);
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error }, { status: res.status });
    }

    console.log("[create-customer] PAY.JP response:", JSON.stringify(data, null, 2));

    // tds_id は customer 直下 or カードオブジェクト内、または tds_url から抽出
    const tdsUrl: string | null =
      data.tds_url ?? data.cards?.data?.[0]?.tds_url ?? null;
    const tdsIdFromUrl = tdsUrl?.match(/\/tds\/([^/?]+)/)?.[1] ?? null;
    const tdsId: string | null =
      data.tds_id ?? data.cards?.data?.[0]?.tds_id ?? tdsIdFromUrl ?? null;

    console.log("[create-customer] customerId:", data.id, "tdsId:", tdsId, "tdsUrl:", tdsUrl);
    return NextResponse.json({ customerId: data.id, tdsUrl, tdsId });
  } catch (e) {
    const message = e instanceof Error ? e.message : "顧客作成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
