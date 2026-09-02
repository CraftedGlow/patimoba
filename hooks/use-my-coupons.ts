"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"

export interface MyCoupon {
  deliveryId: string
  couponId: string
  title: string
  discountType: "percentage" | "fixed"
  discountValue: number
  validFrom: string | null
  expiresAt: string | null
  minOrderAmount: number | null
  wholeCakeOnly: boolean
}

export interface MyCouponEligibility extends MyCoupon {
  eligible: boolean
  reason: string | null
}

interface UseMyCouponsOptions {
  userId?: string | null
  storeId?: string | null
}

export function useMyCoupons({ userId, storeId }: UseMyCouponsOptions) {
  const [coupons, setCoupons] = useState<MyCoupon[]>([])
  const [loading, setLoading] = useState(false)

  const fetchCoupons = useCallback(async () => {
    if (!userId || !storeId) {
      setCoupons([])
      return
    }
    setLoading(true)
    try {
      const res = await fetch(`/api/coupons/my-coupons?userId=${userId}&storeId=${storeId}`)
      const data = await res.json()
      setCoupons(data.coupons ?? [])
    } finally {
      setLoading(false)
    }
  }, [userId, storeId])

  useEffect(() => {
    fetchCoupons()
  }, [fetchCoupons])

  // カート内容を突き合わせて、各クーポンが今この場で使えるかを判定する。
  // 最終的な可否はサーバー側 (/api/coupons/apply) で再検証されるため、ここではUX用のヒントでよい。
  const evaluateEligibility = useCallback(
    async (subtotal: number, productIds: string[]): Promise<MyCouponEligibility[]> => {
      const needsWholeCakeCheck = coupons.some((c) => c.wholeCakeOnly)
      let hasWholeCakeProduct = false
      if (needsWholeCakeCheck && productIds.length > 0) {
        const { data } = await supabase
          .from("products")
          .select("id")
          .in("id", productIds)
          .eq("is_preorder_required", true)
        hasWholeCakeProduct = (data ?? []).length > 0
      }

      const now = new Date()
      return coupons.map((c) => {
        if (c.validFrom && now < new Date(c.validFrom)) {
          return { ...c, eligible: false, reason: "まだ利用開始前です" }
        }
        if (c.expiresAt && now > new Date(c.expiresAt)) {
          return { ...c, eligible: false, reason: "有効期限が切れています" }
        }
        if (c.minOrderAmount && subtotal < c.minOrderAmount) {
          return { ...c, eligible: false, reason: `${c.minOrderAmount.toLocaleString()}円以上のご注文で利用可能です` }
        }
        if (c.wholeCakeOnly && !hasWholeCakeProduct) {
          return { ...c, eligible: false, reason: "ホールケーキのご注文で利用可能です" }
        }
        return { ...c, eligible: true, reason: null }
      })
    },
    [coupons]
  )

  return { coupons, loading, evaluateEligibility, refetch: fetchCoupons }
}
