"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { UIShippingFee, toUIShippingFee } from "@/lib/types"

export function useShippingFees(storeId?: string) {
  const [shippingFees, setShippingFees] = useState<UIShippingFee[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchShippingFees = useCallback(async () => {
    setLoading(true)
    setError(null)
    let query = supabase
      .from("shipping_fees")
      .select("*")
      .order("min_distance", { ascending: true })
    if (storeId) query = query.eq("store_id", storeId)
    const { data, error: err } = await query
    if (err) setError(err.message)
    else setShippingFees((data || []).map(toUIShippingFee))
    setLoading(false)
  }, [storeId])

  useEffect(() => {
    fetchShippingFees()
  }, [fetchShippingFees])

  const addShippingFee = async (input: { minDistance: number; maxDistance: number; price: number }) => {
    if (!storeId) return { error: "店舗未設定" }
    const { error: err } = await supabase.from("shipping_fees").insert({
      store_id: storeId,
      min_distance: input.minDistance,
      max_distance: input.maxDistance,
      price: input.price,
    })
    if (!err) await fetchShippingFees()
    return { error: err?.message || null }
  }

  const updateShippingFee = async (
    id: string,
    updates: { minDistance?: number; maxDistance?: number; price?: number }
  ) => {
    const payload: any = {}
    if (updates.minDistance !== undefined) payload.min_distance = updates.minDistance
    if (updates.maxDistance !== undefined) payload.max_distance = updates.maxDistance
    if (updates.price !== undefined) payload.price = updates.price
    const { error: err } = await supabase.from("shipping_fees").update(payload).eq("id", id)
    if (!err) await fetchShippingFees()
    return { error: err?.message || null }
  }

  const deleteShippingFee = async (id: string) => {
    const { error: err } = await supabase.from("shipping_fees").delete().eq("id", id)
    if (!err) await fetchShippingFees()
    return { error: err?.message || null }
  }

  const calcFee = (distance: number): number => {
    const match = shippingFees.find(
      (f) => distance >= f.minDistance && distance <= f.maxDistance
    )
    return match ? match.price : 0
  }

  return {
    shippingFees,
    loading,
    error,
    refetch: fetchShippingFees,
    addShippingFee,
    updateShippingFee,
    deleteShippingFee,
    calcFee,
  }
}
