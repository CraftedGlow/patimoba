import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { payjpPost } from "@/lib/payjp";

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
    .select("id, order_status, payment_status, cancel_deadline_at, payjp_charge_id, customer_id, discount_amount")
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

  // クレジットカード決済済みの場合は PAY.JP で返金
  if (order.payment_status === "paid" && order.payjp_charge_id) {
    const refundRes = await payjpPost(`/charges/${order.payjp_charge_id}/refund`, {})
    const refundData = await refundRes.json()
    if (!refundRes.ok) {
      console.error("[cancel] PAY.JP 返金エラー:", refundData)
      return NextResponse.json({ error: "返金処理に失敗しました。お手数ですが店舗までご連絡ください。" }, { status: 500 })
    }
  }

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
