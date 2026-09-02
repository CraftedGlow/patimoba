"use client"

import { supabase } from "@/lib/supabase"
import type { OrderStatus, UICartItem } from "@/lib/types"
import { isDevOnlyStoreVisible } from "@/lib/store-visibility"

interface CreateOrderInput {
  storeId: string
  customerId: string | null
  customerName?: string | null
  paymentStatus?: string
  paymentMethod?: string | null
  items: UICartItem[]
  subtotal: number
  discountAmount?: number
  couponId?: string | null
  couponDeliveryId?: string | null
  couponDiscountAmount?: number
  pickupDate?: string | null
  pickupTime?: string | null
  notes?: string
  orderType?: string
  printPhotoUrl?: string | null
  guestEmail?: string | null
  payjpChargeId?: string | null
  bag?: { name: string; unitPrice: number; quantity: number } | null
}

async function releaseCoupon(deliveryId: string) {
  try {
    await fetch("/api/coupons/release", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deliveryId }),
    })
  } catch {
    // ベストエフォート。失敗しても注文エラーの主目的は達成済みなので無視する
  }
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
    const couponDiscountAmount = input.couponDeliveryId ? (input.couponDiscountAmount ?? 0) : 0
    const totalAmount = Math.max(0, input.subtotal - (input.discountAmount ?? 0) - couponDiscountAmount)

    const derived = deriveOrderType(input.items, input.orderType)
    if (derived.error) {
      if (input.couponDeliveryId) await releaseCoupon(input.couponDeliveryId)
      return { orderId: "", error: derived.error }
    }

    // 開発用の架空店舗は本番環境では注文を作成できない
    const { data: storeRow } = await supabase
      .from("stores")
      .select("is_dev_only")
      .eq("id", input.storeId)
      .maybeSingle()
    if (!isDevOnlyStoreVisible(storeRow?.is_dev_only)) {
      if (input.couponDeliveryId) await releaseCoupon(input.couponDeliveryId)
      return { orderId: "", error: "この店舗では注文できません" }
    }

    const cancelDeadlineAt = (() => {
      if (input.pickupDate) {
        // pickup_date の2日前 23:59:59 JST (= 14:59:59 UTC)
        const [y, m, d] = input.pickupDate.split("-").map(Number)
        return new Date(Date.UTC(y, m - 1, d - 2, 14, 59, 59)).toISOString()
      }
      // 受取日未定の場合は7日後
      const d = new Date()
      d.setDate(d.getDate() + 7)
      return d.toISOString()
    })()

    const { data: order, error: orderErr } = await supabase
      .from("orders")
      .insert({
        store_id: input.storeId,
        customer_id: input.customerId,
        customer_name_snapshot: input.customerName ?? null,
        order_type: derived.type,
        order_status: "pending",
        payment_status: input.paymentStatus ?? "unpaid",
        payment_method: input.paymentMethod ?? null,
        subtotal: input.subtotal,
        discount_amount: input.discountAmount ?? 0,
        coupon_id: input.couponDeliveryId ? (input.couponId ?? null) : null,
        coupon_discount_amount: couponDiscountAmount,
        total_amount: totalAmount,
        pickup_date: input.pickupDate ?? null,
        pickup_time: input.pickupTime ?? null,
        notes: input.notes ?? "",
        print_photo_url: input.printPhotoUrl ?? null,
        guest_email: input.guestEmail ?? null,
        cancel_deadline_at: cancelDeadlineAt,
        payjp_charge_id: input.payjpChargeId ?? null,
      })
      .select("id")
      .single()

    if (orderErr || !order) {
      if (input.couponDeliveryId) await releaseCoupon(input.couponDeliveryId)
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
        const customOptionSum = (c.customOptions || []).reduce((s, op) => s + (op.additionalPrice || 0), 0)
        const noshiPrice = c.noshi?.price ?? 0
        const messagePlatePrice = c.messagePlateOption?.price ?? 0
        return (
          item.price * item.quantity +
          ((c.sizePrice ?? 0) + candleSum + optionSum + customOptionSum + noshiPrice + messagePlatePrice) * item.quantity
        )
      }

      // レシート印字用の短縮名を解決するため、商品のカスタムオプション定義と
      // デコレーション選択肢の短縮名をまとめて取得しておく（注文作成時にスナップショット）
      const productIds = Array.from(new Set(input.items.map((i) => i.productId).filter(Boolean))) as string[]
      const { data: printShortNameProducts } = productIds.length
        ? await supabase.from("products").select("id, print_short_name, custom_options").in("id", productIds)
        : { data: [] as any[] }
      const productPrintInfoMap = new Map((printShortNameProducts ?? []).map((p: any) => [p.id, p]))

      const decorationIds = Array.from(
        new Set(
          input.items.flatMap((i) => (i.customization?.options ?? []).map((o) => o.wholeCakeOptionId)).filter(Boolean)
        )
      )
      const { data: printShortNameDecorations } = decorationIds.length
        ? await supabase.from("decorations").select("id, print_short_name").in("id", decorationIds)
        : { data: [] as any[] }
      const decorationShortNameMap = new Map((printShortNameDecorations ?? []).map((d: any) => [d.id, d.print_short_name]))

      const orderItems: any[] = input.items.map((item) => ({
        order_id: order.id,
        product_id: item.productId,
        product_name_snapshot: item.name,
        product_short_name_snapshot: productPrintInfoMap.get(item.productId)?.print_short_name ?? null,
        quantity: item.quantity,
        unit_price: item.price,
        subtotal: calcItemSubtotal(item),
        variant_name_snapshot: item.customization?.sizeLabel ?? null,
      }))

      // 袋は特定商品に紐づく行ではなく注文全体への追加なので、product_id なしの行として追加する
      if (input.bag) {
        orderItems.push({
          order_id: order.id,
          product_id: null,
          product_name_snapshot: `袋: ${input.bag.name}`,
          quantity: input.bag.quantity,
          unit_price: input.bag.unitPrice,
          subtotal: input.bag.unitPrice * input.bag.quantity,
          variant_name_snapshot: null,
        })
      }

      const { data: insertedItems, error: itemsErr } = await supabase
        .from("order_items")
        .insert(orderItems)
        .select("id")
      if (itemsErr) throw itemsErr

      // order_item_options にカスタマイズ情報を保存
      for (let i = 0; i < input.items.length; i++) {
        const item = input.items[i]
        const insertedId = insertedItems?.[i]?.id
        if (!item.customization || !insertedId) continue
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
            option_group_name_snapshot: op.groupName ?? "デコレーション",
            option_item_name_snapshot: op.name,
            option_item_short_name_snapshot: decorationShortNameMap.get(op.wholeCakeOptionId) ?? null,
            price_delta: op.price,
          })
          if (op.message) {
            options.push({
              order_item_id: insertedId,
              option_group_name_snapshot: "プレートメッセージ",
              option_item_name_snapshot: `${op.name}「${op.message}」`,
              price_delta: 0,
            })
          }
        }
        if (c.messagePlateOption) {
          options.push({
            order_item_id: insertedId,
            option_group_name_snapshot: "メッセージプレート",
            option_item_name_snapshot: c.messagePlateOption.name,
            price_delta: c.messagePlateOption.price || 0,
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
        for (const co of c.customOptions || []) {
          if (!co.values?.length) continue
          const productCustomOptions = productPrintInfoMap.get(item.productId)?.custom_options as
            | { name: string; values: { label: string; print_short_name?: string }[] }[]
            | undefined
          const matchingGroup = productCustomOptions?.find((g) => g.name === co.name)
          const hasShortNames = co.values.some((label) =>
            matchingGroup?.values.find((v) => v.label === label)?.print_short_name
          )
          const shortNameJoined = hasShortNames
            ? co.values
                .map((label) => matchingGroup?.values.find((v) => v.label === label)?.print_short_name || label)
                .join("、")
            : null
          options.push({
            order_item_id: insertedId,
            option_group_name_snapshot: co.name,
            option_item_name_snapshot: co.values.join("、"),
            option_item_short_name_snapshot: shortNameJoined,
            price_delta: co.additionalPrice || 0,
          })
        }
        if (c.noshi) {
          options.push({
            order_item_id: insertedId,
            option_group_name_snapshot: "のし",
            option_item_name_snapshot: c.noshi.name,
            price_delta: c.noshi.price || 0,
          })
          if (c.noshi.purpose) {
            options.push({
              order_item_id: insertedId,
              option_group_name_snapshot: "のし用途",
              option_item_name_snapshot: c.noshi.purpose,
              price_delta: 0,
            })
          }
          if (c.noshi.displayName) {
            options.push({
              order_item_id: insertedId,
              option_group_name_snapshot: "のし名前",
              option_item_name_snapshot: c.noshi.displayName,
              price_delta: 0,
            })
          }
        }

        if (options.length > 0) {
          const { error: optErr } = await supabase.from("order_item_options").insert(options)
          if (optErr) throw optErr
        }
      }

      if (input.couponDeliveryId) {
        try {
          // 注文をクーポン券に紐付けると同時に、サーバー側で計算・保存済みの正しい割引額へ
          // coupon_discount_amount / total_amount を上書き訂正する（この insert 自体はクライアント
          // 直接書き込みのため、ここで金額の正しさを最終的に担保する）
          await fetch("/api/coupons/finalize", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ deliveryId: input.couponDeliveryId, orderId: order.id }),
          })
        } catch {
          // 失敗しても注文自体は成立させる（ベストエフォート）
        }
      }

      return { orderId: String(order.id), error: null }
    } catch (e: any) {
      await supabase.from("order_items").delete().eq("order_id", order.id)
      await supabase.from("orders").delete().eq("id", order.id)
      if (input.couponDeliveryId) await releaseCoupon(input.couponDeliveryId)
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
