"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"

export interface ProductType {
  id: string
  productType: string
  typeCode: number
}

export function useProductTypes() {
  const [productTypes, setProductTypes] = useState<ProductType[]>([])
  const [categories, setCategories] = useState<string[]>(["すべて"])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProductTypes = async () => {
    setLoading(true)
    setError(null)
    const { data, error: err } = await supabase
      .from("product_types")
      .select("*")
      .order("type_code")
    if (err) {
      setError(err.message)
    } else {
      const types = (data || []).map((row: any) => ({
        id: String(row.id),
        productType: row.product_type || "",
        typeCode: Number(row.type_code) || 0,
      }))
      setProductTypes(types)
      setCategories(["すべて", ...types.map((t) => t.productType)])
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchProductTypes()
  }, [])

  return { productTypes, categories, loading, error, refetch: fetchProductTypes }
}
