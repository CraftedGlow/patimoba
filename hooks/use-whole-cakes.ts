"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
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
        printDecorationEnabled: product.print_decoration_enabled ?? false,
        isActive: product.is_active ?? true,
        sameDayOrderAllowed: product.same_day_order_allowed ?? false,
        customOptions: Array.isArray(product.custom_options) ? product.custom_options : [],
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

  return { wholeCakes, loading, error, refetch: fetchWholeCakes }
}
