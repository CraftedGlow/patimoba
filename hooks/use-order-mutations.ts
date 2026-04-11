"use client"

import { supabase } from "@/lib/supabase"
import type { OrderStatus, PaymentMethod, UICartItem, UIDeliveryAddress } from "@/lib/types"

interface CustomerInfoInput {
  lastNameKj?: string
  firstNameKj?: string
  lastNameKn?: string
  firstNameKn?: string
  email?: string
  phone?: string
  postalCode?: string
  address?: string
  building?: string
}

interface CreateOrderInput {
  storeId: string
  customerId: string | null
  paymentMethod: PaymentMethod
  items: UICartItem[]
  subtotal: number
  shippingFee?: number
  sameDay?: boolean
  pickupDate?: string | null
  pickupTimeSlot?: string | null
  visitTime?: string | null
  deliveryPreference?: boolean
  notes?: string
  usedPoints?: number
  couponAmount?: number
  orderType?: string
  customerInfo?: CustomerInfoInput
  deliveryAddress?: UIDeliveryAddress | null
}

interface CreateOrderResult {
  orderId: string
  error: string | null
}

export function useOrderMutations() {
  const createOrder = async (input: CreateOrderInput): Promise<CreateOrderResult> => {
    const total = input.subtotal + (input.shippingFee ?? 0) - (input.usedPoints ?? 0) - (input.couponAmount ?? 0)

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        store_id: input.storeId,
        customer_id: input.customerId,
        order_type: input.orderType ?? "takeout",
        payment_method: input.paymentMethod || "",
        subtotal: input.subtotal,
        total,
        same_day: input.sameDay ?? false,
        pickup_date: input.pickupDate ?? null,
        pickup_time_slot: input.pickupTimeSlot ?? "",
        visit_time: input.visitTime ?? "",
        delivery_preference: input.deliveryPreference ?? false,
        notes: input.notes ?? "",
        points_used: input.usedPoints ?? 0,
        coupon_amount: input.couponAmount ?? 0,
        shipping_included: (input.shippingFee ?? 0) > 0,
        status: "pending" as OrderStatus,
        preparing: false,
        order_confirmed: true,
      })
      .select("id")
      .single()

    if (orderErr || !order) {
      return { orderId: "", error: orderErr?.message || "注文の作成に失敗しました" }
    }

    try {
      const orderItems = input.items.map((item) => ({
        order_id: order.id,
        product_id: item.isCustomCake ? null : item.productId,
        whole_cake_product_id: item.isCustomCake ? item.productId : null,
        name: item.name,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: item.price * item.quantity + (item.customization?.sizePrice ?? 0) * item.quantity,
      }))

      const { data: insertedItems, error: itemsErr } = await supabase
        .from("order_items")
        .insert(orderItems)
        .select("id")
      if (itemsErr) throw itemsErr

      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i]
        const insertedId = insertedItems?.[i]?.id
        if (!item.isCustomCake || !item.customization || !insertedId) continue
        const c = item.customization

        const details: any[] = []
        if (c.sizeId) {
          details.push({
            order_item_id: insertedId,
            detail_type: "size",
            label: c.sizeLabel ?? "",
            price: c.sizePrice ?? 0,
            whole_cake_size_id: c.sizeId,
          })
        }
        if (c.candleTypeId && c.candleCount) {
          details.push({
            order_item_id: insertedId,
            detail_type: "candle",
            label: c.candleName ?? "",
            price: c.candlePrice ?? 0,
            quantity: c.candleCount,
            candle_option_id: c.candleTypeId,
          })
        }
        if (c.optionTypeId) {
          details.push({
            order_item_id: insertedId,
            detail_type: "option",
            label: c.optionName ?? "",
            price: c.optionPrice ?? 0,
            whole_cake_option_id: c.optionTypeId,
          })
        }
        if (c.messagePlate) {
          details.push({
            order_item_id: insertedId,
            detail_type: "message",
            label: "メッセージ",
            price: 0,
            message_text: c.messagePlate,
          })
        }

        if (details.length > 0) {
          const { error: detErr } = await supabase.from("order_item_details").insert(details)
          if (detErr) throw detErr
        }
      }

      if (input.customerInfo) {
        const ci = input.customerInfo
        const { error: ciErr } = await supabase
          .from("order_customer_info")
          .insert({
            order_id: order.id,
            customer_id: input.customerId,
            last_name_kj: ci.lastNameKj ?? "",
            first_name_kj: ci.firstNameKj ?? "",
            last_name_kn: ci.lastNameKn ?? "",
            first_name_kn: ci.firstNameKn ?? "",
            email: ci.email ?? "",
            phone: ci.phone ?? "",
            postal_code: ci.postalCode ?? "",
            address: ci.address ?? "",
            building: ci.building ?? "",
          })
        if (ciErr) throw ciErr
      }

      if (input.deliveryAddress) {
        await supabase
          .from("orders")
          .update({ shipping_address: [
            input.deliveryAddress.postalCode,
            input.deliveryAddress.prefecture,
            input.deliveryAddress.city,
            input.deliveryAddress.address,
            input.deliveryAddress.building,
          ].filter(Boolean).join(" ") })
          .eq("id", order.id)
      }

      return { orderId: String(order.id), error: null }
    } catch (e: any) {
      await supabase.from("order_items").delete().eq("order_id", order.id)
      await supabase.from("order_customer_info").delete().eq("order_id", order.id)
      await supabase.from("orders").delete().eq("id", order.id)
      return { orderId: "", error: e?.message || "注文処理中にエラーが発生しました" }
    }
  }

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const payload: any = { status }
    if (status === "completed") {
      payload.order_completed_at = new Date().toISOString()
      payload.preparing = true
    } else if (status === "ready" || status === "preparing") {
      payload.preparing = true
    } else if (status === "pending" || status === "confirmed") {
      payload.preparing = false
    }
    const { error } = await supabase.from("orders").update(payload).eq("id", orderId)
    return { error: error?.message || null }
  }

  const togglePrepared = async (orderId: string, prepared: boolean) => {
    const { error } = await supabase
      .from("orders")
      .update({
        preparing: prepared,
        status: prepared ? "ready" : "confirmed",
        order_completed_at: prepared ? new Date().toISOString() : null,
      })
      .eq("id", orderId)
    return { error: error?.message || null }
  }

  const deleteOrder = async (orderId: string) => {
    const { data: items } = await supabase.from("order_items").select("id").eq("order_id", orderId)
    if (items && items.length > 0) {
      const itemIds = items.map((i: any) => i.id)
      await supabase.from("order_item_details").delete().in("order_item_id", itemIds)
    }
    await supabase.from("order_items").delete().eq("order_id", orderId)
    await supabase.from("order_customer_info").delete().eq("order_id", orderId)
    const { error } = await supabase.from("orders").delete().eq("id", orderId)
    return { error: error?.message || null }
  }

  return { createOrder, updateOrderStatus, togglePrepared, deleteOrder }
}
