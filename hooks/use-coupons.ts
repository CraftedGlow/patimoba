"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { UICoupon, toUICoupon } from "@/lib/types"

export function useCoupons(storeId?: string) {
  const [coupons, setCoupons] = useState<UICoupon[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchCoupons = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase.from("coupons").select("*").order("created_at", { ascending: false })
    if (storeId) query = query.eq("store_id", storeId)
    const { data, error: err } = await query
    if (err) setError(err.message)
    else setCoupons((data || []).map(toUICoupon))
    setLoading(false)
  }, [storeId])

  useEffect(() => {
    fetchCoupons()
  }, [fetchCoupons])

  const addCoupon = async (input: { name: string; discountPrice: number }) => {
    if (!storeId) return { error: "店舗未設定" }
    const { error: err } = await supabase.from("coupons").insert({
      store_id: storeId,
      name: input.name,
      discount_price: input.discountPrice,
    })
    if (!err) await fetchCoupons()
    return { error: err?.message || null }
  }

  const updateCoupon = async (id: string, updates: { name?: string; discountPrice?: number }) => {
    const payload: any = {}
    if (updates.name !== undefined) payload.name = updates.name
    if (updates.discountPrice !== undefined) payload.discount_price = updates.discountPrice
    const { error: err } = await supabase.from("coupons").update(payload).eq("id", id)
    if (!err) await fetchCoupons()
    return { error: err?.message || null }
  }

  const deleteCoupon = async (id: string) => {
    const { error: err } = await supabase.from("coupons").delete().eq("id", id)
    if (!err) await fetchCoupons()
    return { error: err?.message || null }
  }

  return { coupons, loading, error, refetch: fetchCoupons, addCoupon, updateCoupon, deleteCoupon }
}
