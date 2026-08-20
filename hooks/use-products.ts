"use client"

import { useState, useEffect } from "react"
import { supabase } from "@/lib/supabase"
import { Product, ManagedProduct, toUIProduct, toUIManagedProduct } from "@/lib/types"
import { toLocalDateString } from "@/lib/date-utils"
import { fetchProductStoreOverrides, applyProductStoreOverride } from "@/lib/store-hierarchy"

interface UseProductsOptions {
  storeId?: string
  publishedOnly?: boolean
  category?: string
  ecOnly?: boolean
  takeoutOnly?: boolean
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
      .select("*, product_variants(id, price, is_active)")

    let parentStoreId: string | null = null
    if (options.storeId) {
      const storeIds = [options.storeId]
      const { data: storeData } = await supabase
        .from("stores")
        .select("parent_store_id")
        .eq("id", options.storeId)
        .single()
      if (storeData?.parent_store_id) {
        parentStoreId = storeData.parent_store_id
        storeIds.push(parentStoreId)
      }
      query = query.in("store_id", storeIds)
    }
    // 共有商品は店舗ごとの上書きで is_active が変わりうるため、階層がある場合は
    // publishedOnly の is_active 絞り込みをマージ後に行う
    if (options.publishedOnly) {
      if (parentStoreId === null) query = query.eq("is_active", true)
      const todayStr = toLocalDateString(new Date())
      query = query.or(`limited_until.is.null,limited_until.gte.${todayStr}`)
    }
    if (options.ecOnly) {
      query = query.eq("is_ec", true)
    }
    if (options.takeoutOnly) {
      query = query.eq("is_takeout", true)
    }

    const [{ data, error: err }, overrides] = await Promise.all([
      query
        .order("display_order", { ascending: true })
        .order("category_name", { ascending: true })
        .order("base_price", { ascending: true })
        .order("created_at", { ascending: true }),
      options.storeId ? fetchProductStoreOverrides(options.storeId, parentStoreId) : Promise.resolve(new Map()),
    ])
    if (err) {
      setError(err.message)
    } else {
      let rows = (data || []).map((row: any) => applyProductStoreOverride(row, row.id, parentStoreId, overrides))
      if (options.publishedOnly && parentStoreId !== null) {
        rows = rows.filter((row: any) => row.is_active)
      }
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
