import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { buildReceiptMarkup } from "@/lib/star-markup"
import { resolveOptionPrintName } from "@/lib/receipt-short-names"

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
)

export async function POST(req: NextRequest) {
  try {
    const {
      orderId,
      lineName,
      phone,
      orderDate,
      paymentStatus,
    } = await req.json()
    if (!orderId) {
      return NextResponse.json({ error: "orderId required" }, { status: 400 })
    }

    const { data: order, error } = await supabaseAdmin
      .from("orders")
      .select(`
        id, order_no, store_id, customer_name_snapshot,
        subtotal, discount_amount, coupon_discount_amount, total_amount,
        pickup_date, pickup_time,
        order_items (
          product_id, product_name_snapshot, product_short_name_snapshot, quantity, unit_price, subtotal,
          variant_name_snapshot,
          order_item_options (
            option_group_name_snapshot,
            option_item_name_snapshot,
            option_item_short_name_snapshot,
            decoration_id,
            product_id,
            price_delta,
            quantity
          )
        ),
        stores ( name, is_master, parent_store_id ),
        coupons ( title )
      `)
      .eq("id", orderId)
      .single()

    if (error || !order) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 })
    }

    // 注文後に印刷用短縮名が追加/変更された場合にも反映されるよう、
    // スナップショットではなく商品/デコレーションの現在値を優先して使う
    const orderItemsRaw = (order.order_items as any[]) ?? []
    const productIds = Array.from(
      new Set([
        ...orderItemsRaw.map((it) => it.product_id),
        ...orderItemsRaw.flatMap((it) => (it.order_item_options ?? []).map((o: any) => o.product_id)),
      ].filter(Boolean))
    )
    const { data: currentProducts } = productIds.length
      ? await supabaseAdmin.from("products").select("id, print_short_name, custom_options").in("id", productIds)
      : { data: [] as any[] }
    const currentShortNameMap = new Map((currentProducts ?? []).map((p: any) => [p.id, p.print_short_name]))
    const productCustomOptionsMap = new Map((currentProducts ?? []).map((p: any) => [p.id, p.custom_options]))

    const decorationIds = Array.from(
      new Set(orderItemsRaw.flatMap((it) => (it.order_item_options ?? []).map((o: any) => o.decoration_id)).filter(Boolean))
    )
    const { data: currentDecorations } = decorationIds.length
      ? await supabaseAdmin.from("decorations").select("id, print_short_name").in("id", decorationIds)
      : { data: [] as any[] }
    const decorationShortNameMap = new Map((currentDecorations ?? []).map((d: any) => [d.id, d.print_short_name]))

    // 単独店舗では自明なので印字しない。マスター店舗/子店舗の場合のみ、
    // どの店舗の注文かを区別できるよう店舗名を印字する
    const store = order.stores as any
    const isMultiStore = !!store?.is_master || !!store?.parent_store_id

    const markup = buildReceiptMarkup({
      storeName: isMultiStore ? (store?.name ?? null) : null,
      orderNo: order.order_no,
      pickupDate: order.pickup_date,
      pickupTime: order.pickup_time,
      customerName: order.customer_name_snapshot,
      lineName: lineName ?? null,
      phone: phone ?? null,
      orderDate: orderDate ?? null,
      paymentStatus: paymentStatus ?? null,
      items: orderItemsRaw.map((item) => ({
        name: (item.product_id && currentShortNameMap.get(item.product_id)) || item.product_short_name_snapshot || item.product_name_snapshot,
        quantity: item.quantity,
        subtotal: item.subtotal,
        variantName: item.variant_name_snapshot,
        options: (item.order_item_options ?? []).map((opt: any) => ({
          groupName: opt.option_group_name_snapshot,
          itemName: resolveOptionPrintName(opt, decorationShortNameMap, productCustomOptionsMap),
          priceDelta: opt.price_delta,
          quantity: opt.quantity,
        })),
      })),
      subtotal: order.subtotal,
      discountAmount: order.discount_amount,
      couponDiscountAmount: order.coupon_discount_amount,
      couponTitle: (order.coupons as any)?.title ?? null,
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
