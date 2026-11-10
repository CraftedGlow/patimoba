"use client"

import { supabase } from "@/lib/supabase"
import { authFetch } from "@/lib/auth-fetch"
import type { OrderStatus, UICartItem } from "@/lib/types"

interface CreateOrderInput {
  /** 注文確定の試行ごとに1つ生成するUUID。再送時は同じ値を送ると、作成済みの注文が返る（二重注文防止） */
  clientRequestId: string
  storeId: string
  customerId: string | null
  customerName?: string | null
  paymentMethod: "credit" | "store"
  items: UICartItem[]
  /** 利用ポイント */
  discountAmount?: number
  couponId?: string | null
  couponDeliveryId?: string | null
  pickupDate?: string | null
  pickupTime?: string | null
  notes?: string
  guestEmail?: string | null
  /** 画面に表示していた支払合計。サーバー側で確定した金額と一致しない場合は注文を確定しない */
  expectedTotal: number
  bag?: { id: string; quantity: number } | null
}

interface CreateOrderResult {
  orderId: string
  error: string | null
  /**
   * 注文が作成されたかどうか分からない（通信エラーで応答が届かなかった・別の要求が処理中）。
   * この場合は同じ clientRequestId のまま再送すること（作成済みならその注文が返り、二重には作られない）。
   */
  outcomeUnknown?: boolean
}

export function useOrderMutations() {
  // テイクアウト注文の作成。金額の計算・注文/明細の作成・クーポン確定・ポイント反映・カード課金は
  // すべてサーバー（/api/customer/takeout-order）がDB上の価格から行う。失敗時の取り消しもサーバー側で行われる。
  const createOrder = async (input: CreateOrderInput): Promise<CreateOrderResult> => {
    if (!input.customerId) return { orderId: "", error: "お客様情報が取得できませんでした。お手数ですが再度ログインしてください。" }

    let res: Response
    try {
      res = await authFetch("/api/customer/takeout-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          clientRequestId: input.clientRequestId,
          storeId: input.storeId,
          customerId: input.customerId,
          customerName: input.customerName ?? null,
          paymentMethod: input.paymentMethod,
          items: input.items,
          bag: input.bag ?? null,
          discountAmount: input.discountAmount ?? 0,
          couponId: input.couponDeliveryId ? (input.couponId ?? null) : null,
          couponDeliveryId: input.couponDeliveryId ?? null,
          pickupDate: input.pickupDate ?? null,
          pickupTime: input.pickupTime ?? null,
          notes: input.notes ?? "",
          guestEmail: input.guestEmail ?? null,
          expectedTotal: input.expectedTotal,
        }),
      })
    } catch {
      return { orderId: "", error: "通信エラーが発生しました。もう一度「注文を確定する」を押してください。", outcomeUnknown: true }
    }

    const data = await res.json().catch(() => null)
    if (res.ok && data?.orderId) return { orderId: String(data.orderId), error: null }
    // JSONで応答が返らない（タイムアウト・ゲートウェイエラー等）場合は、サーバー側で注文が作成されたか分からない
    if (!data || data.code === "order_in_progress") {
      return {
        orderId: "",
        error: data?.error || "通信エラーが発生しました。もう一度「注文を確定する」を押してください。",
        outcomeUnknown: true,
      }
    }
    return { orderId: "", error: data.error || "注文の作成に失敗しました" }
  }

  const updateOrderStatus = async (orderId: string, status: OrderStatus) => {
    const payload: any = { order_status: status }
    if (status === "confirmed") {
      payload.confirmed_at = new Date().toISOString()
    }
    return updateUnlessCancelled(orderId, payload)
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
    return updateUnlessCancelled(orderId, payload)
  }

  // お客様がキャンセル済み（返金・ポイント返還済み）の注文を、古い画面からの操作で別の状態に上書きしない
  const updateUnlessCancelled = async (orderId: string, payload: Record<string, unknown>) => {
    const { data, error } = await supabase
      .from("orders")
      .update(payload)
      .eq("id", orderId)
      .neq("order_status", "cancelled")
      .select("id")
    if (error) return { error: error.message }
    if (!data || data.length === 0) return { error: "この注文はキャンセル済みのため変更できません" }
    return { error: null }
  }

  return { createOrder, updateOrderStatus, updateFulfillmentStatus, deleteOrder }
}
