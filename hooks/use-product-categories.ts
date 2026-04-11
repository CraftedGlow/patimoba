"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"

export interface ProductCategory {
  id: string
  storeId: string
  name: string
  sortOrder: number
}

export function useProductCategories(storeId?: string) {
  const [categories, setCategories] = useState<ProductCategory[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetch = useCallback(async () => {
    if (!storeId) {
      setCategories([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from("product_categories")
      .select("*")
      .eq("store_id", storeId)
      .order("sort_order", { ascending: true })

    if (err) {
      setError(err.message)
    } else {
      setCategories(
        (data ?? []).map((row: any) => ({
          id: row.id,
          storeId: row.store_id,
          name: row.name ?? "",
          sortOrder: row.sort_order ?? 0,
        }))
      )
    }
    setLoading(false)
  }, [storeId])

  useEffect(() => {
    fetch()
  }, [fetch])

  return { categories, loading, error, refetch: fetch }
}
