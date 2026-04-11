"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"

export interface ProductRegistration {
  id: number
  store_id: string
  name: string
  descriprion: string
  description: string
  price: number
  image: string | null
  cross_section_image: string | null
  product_type_id: string | null
  always_available: boolean
  cur_same_day: boolean
  preparation_days: number
  order_start_date: string | null
  order_end_date: string | null
  is_ec: boolean
  max_per_day: number
  max_per_order: number
  shipping_type: string | null
  storage_type: string | null
  ingredients: string | null
  expiration_days: number | null
  volume: string | null
  created_date: string | null
}

interface UseProductRegistrationsOptions {
  storeId?: string
  ecOnly?: boolean
}

export function useProductRegistrations(options: UseProductRegistrationsOptions = {}) {
  const [products, setProducts] = useState<ProductRegistration[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = useCallback(async () => {
    if (!options.storeId) {
      setProducts([])
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    let query = supabase
      .from("product_registrations")
      .select("*")
      .eq("store_id", options.storeId)
      .order("id", { ascending: true })

    if (options.ecOnly === true) {
      query = query.eq("is_ec", true)
    } else if (options.ecOnly === false) {
      query = query.or("is_ec.is.null,is_ec.eq.false")
    }

    const { data, error: err } = await query
    if (err) {
      setError(err.message)
    } else {
      setProducts(
        (data ?? []).map((row: any) => ({
          id: row.id,
          store_id: row.store_id ?? "",
          name: row.name ?? "",
          descriprion: row.descriprion ?? "",
          description: row.description ?? "",
          price: row.price ?? 0,
          image: row.image ?? null,
          cross_section_image: row.cross_section_image ?? null,
          product_type_id: row.product_type_id ?? null,
          always_available: row.always_available ?? true,
          cur_same_day: row.cur_same_day ?? false,
          preparation_days: row.preparation_days ?? 0,
          order_start_date: row.order_start_date ?? null,
          order_end_date: row.order_end_date ?? null,
          is_ec: row.is_ec ?? false,
          max_per_day: row.max_per_day ?? 30,
          max_per_order: row.max_per_order ?? 10,
          shipping_type: row.shipping_type ?? null,
          storage_type: row.storage_type ?? null,
          ingredients: row.ingredients ?? null,
          expiration_days: row.expiration_days ?? null,
          volume: row.volume ?? null,
          created_date: row.created_date ?? null,
        }))
      )
    }
    setLoading(false)
  }, [options.storeId, options.ecOnly])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const updateProduct = async (
    id: number,
    updates: Partial<Omit<ProductRegistration, "id" | "store_id">>
  ) => {
    const payload: any = {}
    if (updates.name !== undefined) payload.name = updates.name
    if (updates.descriprion !== undefined) payload.descriprion = updates.descriprion
    if (updates.description !== undefined) payload.description = updates.description
    if (updates.price !== undefined) payload.price = updates.price
    if (updates.image !== undefined) payload.image = updates.image
    if (updates.cross_section_image !== undefined) payload.cross_section_image = updates.cross_section_image
    if (updates.product_type_id !== undefined) payload.product_type_id = updates.product_type_id
    if (updates.always_available !== undefined) payload.always_available = updates.always_available
    if (updates.cur_same_day !== undefined) payload.cur_same_day = updates.cur_same_day
    if (updates.preparation_days !== undefined) payload.preparation_days = updates.preparation_days
    if (updates.max_per_day !== undefined) payload.max_per_day = updates.max_per_day
    if (updates.max_per_order !== undefined) payload.max_per_order = updates.max_per_order
    if (updates.is_ec !== undefined) payload.is_ec = updates.is_ec
    if (updates.shipping_type !== undefined) payload.shipping_type = updates.shipping_type
    if (updates.storage_type !== undefined) payload.storage_type = updates.storage_type
    if (updates.ingredients !== undefined) payload.ingredients = updates.ingredients
    if (updates.expiration_days !== undefined) payload.expiration_days = updates.expiration_days
    if (updates.volume !== undefined) payload.volume = updates.volume

    const { error } = await supabase
      .from("product_registrations")
      .update(payload)
      .eq("id", id)

    if (!error) await fetchProducts()
    return { error: error?.message || null }
  }

  const deleteProduct = async (id: number) => {
    const { error } = await supabase
      .from("product_registrations")
      .delete()
      .eq("id", id)

    if (!error) await fetchProducts()
    return { error: error?.message || null }
  }

  return {
    products,
    loading,
    error,
    refetch: fetchProducts,
    updateProduct,
    deleteProduct,
  }
}
