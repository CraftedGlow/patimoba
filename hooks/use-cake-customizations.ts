"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import { CANDLE_OPTIONS } from "@/lib/constants/product-master"
import {
  WholeCakeSize,
  toUIWholeCakeSize,
} from "@/lib/types"

export interface CandleOption {
  id: string
  name: string
  price: number
  storeId: string
}

interface UseCakeCustomizationsOptions {
  storeId?: string
  productId?: string
}

export function useCakeCustomizations(options: UseCakeCustomizationsOptions = {}) {
  const [sizes, setSizes] = useState<WholeCakeSize[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ろうそくは定数から取得
  const candles: CandleOption[] = CANDLE_OPTIONS.map((c) => ({
    id: c.id,
    name: c.name,
    price: c.price,
    storeId: options.storeId ?? "",
  }))

  const fetchAll = useCallback(async () => {
    setLoading(true)
    setError(null)
    try {
      const sizesPromise = options.productId
        ? supabase.from("product_variants").select("*").eq("product_id", options.productId).order("display_order", { ascending: true })
        : Promise.resolve({ data: [], error: null })

      const [sizesRes] = await Promise.all([sizesPromise])

      if ((sizesRes as any).error) throw (sizesRes as any).error

      setSizes(((sizesRes as any).data || []).map(toUIWholeCakeSize))
    } catch (e: any) {
      setError(e?.message || "読み込みに失敗しました")
    }
    setLoading(false)
  }, [options.storeId, options.productId])

  useEffect(() => {
    fetchAll()
  }, [fetchAll])

  const addSize = async (input: { name: string; price: number }) => {
    if (!options.productId) return { error: "商品未設定" }
    const { error: err } = await supabase.from("product_variants").insert({
      product_id: options.productId,
      name: input.name,
      price: input.price,
    })
    if (!err) await fetchAll()
    return { error: err?.message || null }
  }

  const updateSize = async (id: string, updates: { name?: string; price?: number }) => {
    const payload: any = {}
    if (updates.name !== undefined) payload.name = updates.name
    if (updates.price !== undefined) payload.price = updates.price
    const { error: err } = await supabase.from("product_variants").update(payload).eq("id", id)
    if (!err) await fetchAll()
    return { error: err?.message || null }
  }

  const deleteSize = async (id: string) => {
    const { error: err } = await supabase.from("product_variants").delete().eq("id", id)
    if (!err) await fetchAll()
    return { error: err?.message || null }
  }

  return {
    sizes,
    candles,
    loading,
    error,
    refetch: fetchAll,
    addSize,
    updateSize,
    deleteSize,
  }
}
