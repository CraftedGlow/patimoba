"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Product, ManagedProduct, toUIProduct, toUIManagedProduct } from "@/lib/types"

interface UseProductsOptions {
  storeId?: string
  publishedOnly?: boolean
  category?: string
}

export function useProducts(options: UseProductsOptions = {}) {
  const [products, setProducts] = useState<Product[]>([])
  const [managedProducts, setManagedProducts] = useState<ManagedProduct[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = async () => {
    setLoading(true)
    setError(null)

    let query = supabase
      .from("products")
      .select("*")

    if (options.storeId) {
      query = query.eq("store_id", options.storeId)
    }
    if (options.publishedOnly) {
      query = query.eq("is_active", true)
    }

    const { data, error: err } = await query
      .order("display_order", { ascending: true })
      .order("created_at", { ascending: true })
    if (err) {
      setError(err.message)
    } else {
      const rows = data || []
      setProducts(rows.map((row: any) => toUIProduct(row)))
      setManagedProducts(rows.map((row: any) => toUIManagedProduct(row)))
    }
    setLoading(false)
  }

  useEffect(() => {
    fetchProducts()
  }, [options.storeId, options.publishedOnly])

  return { products, managedProducts, loading, error, refetch: fetchProducts }
}

export function useProduct(id: string) {
  const [product, setProduct] = useState<Product | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    const fetch = async () => {
      setLoading(true)
      const { data, error: err } = await supabase
        .from("products")
        .select("*")
        .eq("id", id)
        .single()
      if (err) {
        setError(err.message)
      } else if (data) {
        setProduct(toUIProduct(data))
      }
      setLoading(false)
    }
    if (id) fetch()
  }, [id])

  return { product, loading, error }
}
