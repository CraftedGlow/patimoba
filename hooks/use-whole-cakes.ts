"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import {
  WholeCakeProduct,
  CandleOption,
  toUICandleOption,
  toUIWholeCakeSize,
  toUIWholeCakeOption,
} from "@/lib/types"

export function useWholeCakes(storeId?: string) {
  const [wholeCakes, setWholeCakes] = useState<WholeCakeProduct[]>([])
  const [candleOptions, setCandleOptions] = useState<CandleOption[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchWholeCakes = async () => {
    setLoading(true)
    setError(null)

    try {
      let productQuery = supabase
        .from("whole_cake_products")
        .select(`
          *,
          whole_cake_sizes(*),
          whole_cake_options(*)
        `)
        .order("sort_order", { ascending: true })

      if (storeId) productQuery = productQuery.eq("store_id", storeId)

      const { data: products, error: prodErr } = await productQuery
      if (prodErr) throw prodErr

      let candleQuery = supabase.from("candle_options").select("*")
      if (storeId) candleQuery = candleQuery.eq("store_id", storeId)
      const { data: candles, error: candleErr } = await candleQuery
      if (candleErr) throw candleErr
      const uiCandles = (candles || []).map(toUICandleOption)
      setCandleOptions(uiCandles)

      const cakes: WholeCakeProduct[] = (products || []).map((product: any) => ({
        id: String(product.id),
        storeId: String(product.store_id),
        name: product.name || "",
        image: product.image || "",
        sizes: (product.whole_cake_sizes || []).map(toUIWholeCakeSize),
        options: (product.whole_cake_options || []).map(toUIWholeCakeOption),
        candles: uiCandles.filter((c) => c.storeId === product.store_id),
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
