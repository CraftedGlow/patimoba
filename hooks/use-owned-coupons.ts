"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { UIOwnedCoupon, toUIOwnedCoupon } from "@/lib/types"

export function useOwnedCoupons(customerId?: string) {
  const [ownedCoupons, setOwnedCoupons] = useState<UIOwnedCoupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchOwnedCoupons = useCallback(async () => {
    if (!customerId) {
      setOwnedCoupons([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from("customer_coupons")
      .select("*, coupons(*)")
      .eq("customer_id", customerId)
    if (err) setError(err.message)
    else setOwnedCoupons((data || []).map(toUIOwnedCoupon))
    setLoading(false)
  }, [customerId])

  useEffect(() => {
    fetchOwnedCoupons()
  }, [fetchOwnedCoupons])

  const useCouponOnce = async (ownedCouponId: string) => {
    const current = ownedCoupons.find((c) => c.id === ownedCouponId)
    if (!current || current.quantity <= 0) return { error: "クーポンがありません" }
    const { error: err } = await supabase
      .from("customer_coupons")
      .update({ quantity: current.quantity - 1 })
      .eq("id", ownedCouponId)
    if (!err) await fetchOwnedCoupons()
    return { error: err?.message || null }
  }

  return { ownedCoupons, loading, error, refetch: fetchOwnedCoupons, useCouponOnce }
}
