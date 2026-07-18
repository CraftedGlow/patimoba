import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const UNCANCELLABLE_STATUSES = ["cancelled", "completed"]

export async function POST(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const { orderId } = params
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 })
  }

  const { data: order, error: fetchErr } = await supabaseAdmin
    .from("orders")
    .select("id, order_status, payment_status, cancel_deadline_at, customer_id, discount_amount")
    .eq("id", orderId)
    .maybeSingle()

  if (fetchErr || !order) {
    return NextResponse.json({ error: "注文が見つかりませんでした" }, { status: 404 })
  }

  if (UNCANCELLABLE_STATUSES.includes(order.order_status)) {
    return NextResponse.json({ error: "この注文はキャンセルできません" }, { status: 400 })
  }

  if (order.cancel_deadline_at && new Date(order.cancel_deadline_at) < new Date()) {
    return NextResponse.json({ error: "キャンセル期限を過ぎています" }, { status: 400 })
  }

  // payjp_charge_id が orders テーブルに未追加のため返金は現時点でスキップ
  // TODO: orders に payjp_charge_id カラム追加後に実装

  // 使用ポイントを返還
  const discountAmount = Number(order.discount_amount ?? 0)
  if (discountAmount > 0 && order.customer_id) {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("points")
      .eq("id", order.customer_id)
      .maybeSingle()

    if (user) {
      await supabaseAdmin
        .from("users")
        .update({ points: (Number(user.points) ?? 0) + discountAmount })
        .eq("id", order.customer_id)
    }
  }

  // order_status を cancelled に更新（二重キャンセル防止のため条件付き UPDATE）
  const { error: updateErr } = await supabaseAdmin
    .from("orders")
    .update({ order_status: "cancelled" })
    .eq("id", orderId)
    .not("order_status", "in", `(${UNCANCELLABLE_STATUSES.map(s => `"${s}"`).join(",")})`)

  if (updateErr) {
    console.error("[cancel] DB 更新エラー:", updateErr)
    return NextResponse.json({ error: "キャンセル処理に失敗しました" }, { status: 500 })
  }

  return NextResponse.json({ success: true })
}
