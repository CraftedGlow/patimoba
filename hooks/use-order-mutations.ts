"use client"

import { supabase } from "@/lib/supabase"
import type { OrderStatus, UICartItem } from "@/lib/types"

interface CreateOrderInput {
  storeId: string
  customerId: string | null
  paymentStatus?: string
  items: UICartItem[]
  subtotal: number
  discountAmount?: number
  pickupDate?: string | null
  pickupTime?: string | null
  notes?: string
  orderType?: string
}

function deriveOrderType(items: UICartItem[], fallback?: string): { type: string; error: string | null } {
  const hasEc = items.some((i) => i.isEc === true)
  const hasTakeout = items.some((i) => i.isTakeout === true && i.isEc !== true)
  if (hasEc && hasTakeout) {
    return { type: "", error: "EC商品とテイクアウト商品は同時に注文できません" }
  }
  if (hasEc) return { type: "ec", error: null }
  if (hasTakeout) return { type: fallback ?? "takeout", error: null }
  return { type: fallback ?? "pickup", error: null }
}

interface CreateOrderResult {
  orderId: string
  error: string | null
}

export function useOrderMutations() {
  const createOrder = async (input: CreateOrderInput): Promise<CreateOrderResult> => {
    const totalAmount = input.subtotal - (input.discountAmount ?? 0)

    const derived = deriveOrderType(input.items, input.orderType)
    if (derived.error) {
      return { orderId: "", error: derived.error }
    }

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        store_id: input.storeId,
        customer_id: input.customerId,
        order_type: derived.type,
        order_status: "pending",
        payment_status: input.paymentStatus ?? "unpaid",
        subtotal: input.subtotal,
        discount_amount: input.discountAmount ?? 0,
        total_amount: totalAmount,
        pickup_date: input.pickupDate ?? null,
        pickup_time: input.pickupTime ?? null,
        notes: input.notes ?? "",
      })
      .select("id")
      .single()

    if (orderErr || !order) {
      return { orderId: "", error: orderErr?.message || "注文の作成に失敗しました" }
    }

    try {
      const calcItemSubtotal = (item: UICartItem) => {
        const c = item.customization
        if (!c) return item.price * item.quantity
        const candleSum = (c.candles || []).reduce(
          (s, cd) => s + cd.price * cd.quantity,
          0
        )
        const optionSum = (c.options || []).reduce((s, op) => s + op.price, 0)
        return (
          item.price * item.quantity +
          ((c.sizePrice ?? 0) + candleSum + optionSum) * item.quantity
        )
      }

      const orderItems = input.items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        product_name_snapshot: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: calcItemSubtotal(item),
        variant_name_snapshot: item.customization?.sizeLabel ?? null,
      }))

      const { data: insertedItems, error: itemsErr } = await supabase
        .from("order_items")
        .insert(orderItems)
        .select("id")
      if (itemsErr) throw itemsErr

      // order_item_options にカスタマイズ情報を保存
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i]
        const insertedId = insertedItems?.[i]?.id
        if (!item.isCustomCake || !item.customization || !insertedId) continue
        const c = item.customization

        const options: any[] = []
        if (c.sizeId) {
          options.push({
            order_item_id: insertedId,
            option_group_name_snapshot: "サイズ",
            option_item_name_snapshot: c.sizeLabel ?? "",
            price_delta: c.sizePrice ?? 0,
          })
        }
        for (const cd of c.candles || []) {
          if (!cd.candleOptionId || cd.quantity <= 0) continue
          options.push({
            order_item_id: insertedId,
            option_group_name_snapshot: "ろうそく",
            option_item_name_snapshot: cd.name,
            price_delta: cd.price,
            quantity: cd.quantity,
          })
        }
        for (const op of c.options || []) {
          if (!op.wholeCakeOptionId) continue
          options.push({
            order_item_id: insertedId,
            option_group_name_snapshot: "オプション",
            option_item_name_snapshot: op.name,
            price_delta: op.price,
          })
        }
        if (c.messagePlate) {
          options.push({
            order_item_id: insertedId,
            option_group_name_snapshot: "メッセージ",
            option_item_name_snapshot: c.messagePlate,
            price_delta: 0,
          })
        }
        if (c.allergyNote) {
          options.push({
            order_item_id: insertedId,
            option_group_name_snapshot: "アレルギー",
            option_item_name_snapshot: c.allergyNote,
            price_delta: 0,
          })
        }

        if (options.length > 0) {
          const { error: optErr } = await supabase.from("order_item_options").insert(options)
          if (optErr) throw optErr
        }
      }

      return { orderId: String(order.id), error: null }
    } catch (e: any) {
      await supabase.from("order_items").delete().eq("order_id", order.id)
      await supabase.from("orders").delete().eq("id", order.id)
      return { orderId: "", error: e?.message || "注文処理中にエラーが発生しました" }
    }
  }

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const payload: any = { order_status: status }
    if (status === "confirmed") {
      payload.confirmed_at = new Date().toISOString()
    }
    const { error } = await supabase.from("orders").update(payload).eq("id", orderId)
    return { error: error?.message || null }
  }

  const deleteOrder = async (orderId: string) => {
    const { data: items } = await supabase.from("order_items").select("id").eq("order_id", orderId)
    if (items && items.length > 0) {
      const itemIds = items.map((i: any) => i.id)
      await supabase.from("order_item_options").delete().in("order_item_id", itemIds)
    }
    await supabase.from("order_items").delete().eq("order_id", orderId)
    const { error } = await supabase.from("orders").delete().eq("id", orderId)
    return { error: error?.message || null }
  }

  const updateFulfillmentStatus = async (
    orderId: string,
    toFulfilled: boolean,
    staffUserId?: string | null,
  ) => {
    const payload: any = {
      fulfillment_status: toFulfilled ? "fulfilled" : "pending",
      fulfilled_at: toFulfilled ? new Date().toISOString() : null,
      fulfilled_by: toFulfilled ? staffUserId ?? null : null,
    }
    const { error } = await supabase.from("orders").update(payload).eq("id", orderId)
    return { error: error?.message || null }
  }

  return { createOrder, updateOrderStatus, updateFulfillmentStatus, deleteOrder }
}
