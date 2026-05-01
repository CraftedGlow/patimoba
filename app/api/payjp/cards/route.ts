import { NextRequest, NextResponse } from "next/server";
import { payjpGet } from "@/lib/payjp";

// GET /api/payjp/cards?customer_id=<customer_id>
// pay.jp カード情報取得: GET https://api.pay.jp/v1/customers/{id}/cards
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url);
    const customerId = searchParams.get("customer_id");

    if (!customerId) {
      return NextResponse.json({ error: "customer_id は必須です" }, { status: 400 });
    }

    const res = await payjpGet(`/customers/${customerId}/cards`);
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "カード情報取得に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
