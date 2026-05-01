import { NextRequest, NextResponse } from "next/server";
import { payjpPost } from "@/lib/payjp";

// POST /api/payjp/create-customer
// body: { card: "<payjp_token>" }
export async function POST(req: NextRequest) {
  try {
    const { card } = await req.json();

    if (!card) {
      return NextResponse.json({ error: "card トークンは必須です" }, { status: 400 });
    }

    const res = await payjpPost("/customers", { card });
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "顧客作成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
