"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import {
  CandleOption,
  WholeCakeSize,
  WholeCakeOption,
  toUICandleOption,
  toUIWholeCakeSize,
  toUIWholeCakeOption,
} from "@/lib/types"

interface UseCakeCustomizationsOptions {
  storeId?: string
  wholeCakeProductId?: string
}

export function useCakeCustomizations(options: UseCakeCustomizationsOptions = {}) {
  const [sizes, setSizes] = useState<WholeCakeSize[]>([])
  const [candles, setCandles] = useState<CandleOption[]>([])
  const [cakeOptions, setCakeOptions] = useState<WholeCakeOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sizesPromise = options.wholeCakeProductId
        ? supabase.from("whole_cake_sizes").select("*").eq("whole_cake_product_id", options.wholeCakeProductId)
        : Promise.resolve({ data: [], error: null })

      const optsPromise = options.wholeCakeProductId
        ? supabase.from("whole_cake_options").select("*").eq("whole_cake_product_id", options.wholeCakeProductId)
        : Promise.resolve({ data: [], error: null })

      const candlesPromise = options.storeId
        ? supabase.from("candle_options").select("*").eq("store_id", options.storeId)
        : supabase.from("candle_options").select("*")

      const [sizesRes, candlesRes, optsRes] = await Promise.all([
        sizesPromise,
        candlesPromise,
        optsPromise,
      ])

      if ((sizesRes as any).error) throw (sizesRes as any).error
      if ((candlesRes as any).error) throw (candlesRes as any).error
      if ((optsRes as any).error) throw (optsRes as any).error

      setSizes(((sizesRes as any).data || []).map(toUIWholeCakeSize))
      setCandles(((candlesRes as any).data || []).map(toUICandleOption))
      setCakeOptions(((optsRes as any).data || []).map(toUIWholeCakeOption))
    } catch (e: any) {
      setError(e?.message || "読み込みに失敗しました")
    }
    setLoading(false)
  }, [options.storeId, options.wholeCakeProductId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const addSize = async (input: { label: string; servings?: string; price: number }) => {
    if (!options.wholeCakeProductId) return { error: "ホールケーキ未設定" }
    const { error: err } = await supabase.from("whole_cake_sizes").insert({
      whole_cake_product_id: options.wholeCakeProductId,
      label: input.label,
      servings: input.servings ?? "",
      price: input.price,
    })
    if (!err) await fetchAll()
    return { error: err?.message || null }
  }

  const updateSize = async (id: string, updates: { label?: string; servings?: string; price?: number }) => {
    const payload: any = {}
    if (updates.label !== undefined) payload.label = updates.label
    if (updates.servings !== undefined) payload.servings = updates.servings
    if (updates.price !== undefined) payload.price = updates.price
    const { error: err } = await supabase.from("whole_cake_sizes").update(payload).eq("id", id)
    if (!err) await fetchAll()
    return { error: err?.message || null }
  }

  const deleteSize = async (id: string) => {
    const { error: err } = await supabase.from("whole_cake_sizes").delete().eq("id", id)
    if (!err) await fetchAll()
    return { error: err?.message || null }
  }

  const addCandle = async (input: { name: string; price: number }) => {
    if (!options.storeId) return { error: "店舗未設定" }
    const { error: err } = await supabase.from("candle_options").insert({
      store_id: options.storeId,
      name: input.name,
      price: input.price,
    })
    if (!err) await fetchAll()
    return { error: err?.message || null }
  }

  const updateCandle = async (id: string, updates: { name?: string; price?: number }) => {
    const payload: any = {}
    if (updates.name !== undefined) payload.name = updates.name
    if (updates.price !== undefined) payload.price = updates.price
    const { error: err } = await supabase.from("candle_options").update(payload).eq("id", id)
    if (!err) await fetchAll()
    return { error: err?.message || null }
  }

  const deleteCandle = async (id: string) => {
    const { error: err } = await supabase.from("candle_options").delete().eq("id", id)
    if (!err) await fetchAll()
    return { error: err?.message || null }
  }

  const addOption = async (input: {
    name: string
    price: number
    image?: string
    multipleAllowed?: boolean
  }) => {
    if (!options.wholeCakeProductId) return { error: "ホールケーキ未設定" }
    const { error: err } = await supabase.from("whole_cake_options").insert({
      whole_cake_product_id: options.wholeCakeProductId,
      name: input.name,
      price: input.price,
      image: input.image ?? "",
      multiple_allowed: input.multipleAllowed ?? false,
    })
    if (!err) await fetchAll()
    return { error: err?.message || null }
  }

  const updateOption = async (
    id: string,
    updates: { name?: string; price?: number; image?: string; multipleAllowed?: boolean }
  ) => {
    const payload: any = {}
    if (updates.name !== undefined) payload.name = updates.name
    if (updates.price !== undefined) payload.price = updates.price
    if (updates.image !== undefined) payload.image = updates.image
    if (updates.multipleAllowed !== undefined) payload.multiple_allowed = updates.multipleAllowed
    const { error: err } = await supabase.from("whole_cake_options").update(payload).eq("id", id)
    if (!err) await fetchAll()
    return { error: err?.message || null }
  }

  const deleteOption = async (id: string) => {
    const { error: err } = await supabase.from("whole_cake_options").delete().eq("id", id)
    if (!err) await fetchAll()
    return { error: err?.message || null }
  }

  return {
    sizes,
    candles,
    cakeOptions,
    loading,
    error,
    refetch: fetchAll,
    addSize,
    updateSize,
    deleteSize,
    addCandle,
    updateCandle,
    deleteCandle,
    addOption,
    updateOption,
    deleteOption,
  }
}
