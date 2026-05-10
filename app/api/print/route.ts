import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildReceiptMarkup } from "@/lib/star-markup"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json()
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 })
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(`
        id, order_no, store_id, customer_name_snapshot,
        subtotal, discount_amount, total_amount,
        pickup_date, pickup_time,
        order_items (
          product_name_snapshot, quantity, unit_price, subtotal,
          variant_name_snapshot,
          order_item_options (
            option_group_name_snapshot,
            option_item_name_snapshot,
            price_delta,
            quantity
          )
        ),
        stores ( name )
      `)
      .eq("id", orderId)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    const markup = buildReceiptMarkup({
      storeName: (order.stores as any)?.name ?? "PATIMOBA",
      orderNo: order.order_no,
      pickupDate: order.pickup_date,
      pickupTime: order.pickup_time,
      customerName: order.customer_name_snapshot,
      items: ((order.order_items as any[]) ?? []).map((item) => ({
        name: item.product_name_snapshot,
        quantity: item.quantity,
        subtotal: item.subtotal,
        variantName: item.variant_name_snapshot,
        options: (item.order_item_options ?? []).map((opt: any) => ({
          groupName: opt.option_group_name_snapshot,
          itemName: opt.option_item_name_snapshot,
          priceDelta: opt.price_delta,
          quantity: opt.quantity,
        })),
      })),
      subtotal: order.subtotal,
      discountAmount: order.discount_amount,
      totalAmount: order.total_amount,
    })

    const { error: insertErr } = await supabaseAdmin
      .from("print_jobs")
      .insert({
        store_id: order.store_id,
        order_id: order.id,
        markup,
      })

    if (insertErr) {
      return NextResponse.json({ error: insertErr.message }, { status: 500 })
    }

    return NextResponse.json({ ok: true })
  } catch {
    return NextResponse.json({ error: "Internal error" }, { status: 500 })
  }
}
