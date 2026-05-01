import { NextRequest, NextResponse } from "next/server";
import { payjpPost } from "@/lib/payjp";

// POST /api/payjp/tds-finish
// body: { customer_id: "<customer_id>" }
// pay.jp 3Dセキュア完了: POST https://api.pay.jp/v1/customers/{id}/tds_finish
export async function POST(req: NextRequest) {
  try {
    const { customer_id } = await req.json();

    if (!customer_id) {
      return NextResponse.json({ error: "customer_id は必須です" }, { status: 400 });
    }

    const res = await payjpPost(`/customers/${customer_id}/tds_finish`, {});
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "3Dセキュア完了処理に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
