import { NextRequest, NextResponse } from "next/server";
import { payjpPost } from "@/lib/payjp";

// POST /api/payjp/charge
// body: { amount: number, currency: string, customer: string, card?: string, description?: string }
export async function POST(req: NextRequest) {
  try {
    const { amount, currency = "jpy", customer, card, description } = await req.json();

    if (!amount) {
      return NextResponse.json({ error: "amount は必須です" }, { status: 400 });
    }
    if (!customer && !card) {
      return NextResponse.json({ error: "customer または card は必須です" }, { status: 400 });
    }

    const params: Record<string, string> = {
      amount: String(amount),
      currency,
    };
    if (customer) params.customer = customer;
    if (card) params.card = card;
    if (description) params.description = description;

    const res = await payjpPost("/charges", params);
    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error }, { status: res.status });
    }

    return NextResponse.json(data);
  } catch (e) {
    const message = e instanceof Error ? e.message : "決済に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
