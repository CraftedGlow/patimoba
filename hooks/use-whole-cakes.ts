"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { CANDLE_OPTIONS } from "@/lib/constants/product-master"
import {
  WholeCakeProduct,
  toUIWholeCakeSize,
} from "@/lib/types"

export interface CandleOption {
  id: string
  name: string
  price: number
  storeId: string
}

export function useWholeCakes(storeId?: string) {
  const [wholeCakes, setWholeCakes] = useState<WholeCakeProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  // ろうそくは定数から取得
  const candleOptions: CandleOption[] = CANDLE_OPTIONS.map((c) => ({
    id: c.id,
    name: c.name,
    price: c.price,
    storeId: storeId ?? "",
  }))

  const fetchWholeCakes = async () => {
    setLoading(true)
    setError(null)

    try {
      // products + product_variants で取得（is_preorder_required のものがホールケーキ相当）
      let query = supabase
        .from("products")
        .select(`
          *,
          product_variants(*)
        `)
        .eq("is_preorder_required", true)
        .order("display_order", { ascending: true })

      if (storeId) query = query.eq("store_id", storeId)

      const { data: products, error: prodErr } = await query
      if (prodErr) throw prodErr

      const cakes: WholeCakeProduct[] = (products || []).map((product: any) => ({
        id: String(product.id),
        storeId: String(product.store_id),
        name: product.name || "",
        image: product.image || "",
        sizes: (product.product_variants || []).map(toUIWholeCakeSize),
      }))

      setWholeCakes(cakes)
    } catch (e: any) {
      setError(e.message)
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchWholeCakes()
  }, [storeId])

  return { wholeCakes, candleOptions, loading, error, refetch: fetchWholeCakes }
}
