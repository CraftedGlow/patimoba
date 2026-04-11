"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { UIAnniversary, toUIAnniversary } from "@/lib/types"

export function useAnniversaries(customerId?: string, storeId?: string) {
  const [anniversaries, setAnniversaries] = useState<UIAnniversary[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAnniversaries = useCallback(async () => {
    if (!customerId) {
      setAnniversaries([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    let query = supabase
      .from("customer_anniversaries")
      .select("*")
      .eq("customer_id", customerId)
      .order("month", { ascending: true })
      .order("day", { ascending: true })
    if (storeId) query = query.eq("store_id", storeId)
    const { data, error: err } = await query
    if (err) setError(err.message)
    else setAnniversaries((data || []).map(toUIAnniversary))
    setLoading(false)
  }, [customerId, storeId])

  useEffect(() => {
    fetchAnniversaries()
  }, [fetchAnniversaries])

  const addAnniversary = async (input: {
    label: string
    month: number
    day: number
    storeId?: string
  }) => {
    if (!customerId) return { error: "ユーザー未ログイン" }
    const targetStoreId = input.storeId ?? storeId
    if (!targetStoreId) return { error: "店舗未指定" }
    const { error: err } = await supabase.from("customer_anniversaries").insert({
      customer_id: customerId,
      store_id: targetStoreId,
      label: input.label,
      month: input.month,
      day: input.day,
    })
    if (!err) await fetchAnniversaries()
    return { error: err?.message || null }
  }

  const updateAnniversary = async (
    id: string,
    updates: Partial<{ label: string; month: number; day: number }>
  ) => {
    const payload: any = {}
    if (updates.label !== undefined) payload.label = updates.label
    if (updates.month !== undefined) payload.month = updates.month
    if (updates.day !== undefined) payload.day = updates.day

    const { error: err } = await supabase
      .from("customer_anniversaries")
      .update(payload)
      .eq("id", id)
    if (!err) await fetchAnniversaries()
    return { error: err?.message || null }
  }

  const deleteAnniversary = async (id: string) => {
    const { error: err } = await supabase.from("customer_anniversaries").delete().eq("id", id)
    if (!err) await fetchAnniversaries()
    return { error: err?.message || null }
  }

  return {
    anniversaries,
    loading,
    error,
    refetch: fetchAnniversaries,
    addAnniversary,
    updateAnniversary,
    deleteAnniversary,
  }
}

export function useAllAnniversaries(storeId?: string) {
  const [anniversaries, setAnniversaries] = useState<UIAnniversary[]>([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      let query = supabase.from("customer_anniversaries").select("*")
      if (storeId) query = query.eq("store_id", storeId)
      const { data } = await query
      setAnniversaries((data || []).map(toUIAnniversary))
      setLoading(false)
    }
    fetch()
  }, [storeId])

  return { anniversaries, loading }
}
