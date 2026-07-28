"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"

export interface ProductCustomOptionValue {
  label: string
  additional_price: number
}

export interface ProductCustomOption {
  name: string
  type: "single" | "multiple" | "text"
  required: boolean
  values: ProductCustomOptionValue[]
}

export interface ProductRegistration {
  id: string
  store_id: string
  name: string
  description: string
  base_price: number
  image: string | null
  cross_section_image: string | null
  category_name: string | null
  is_active: boolean
  is_preorder_required: boolean
  same_day_order_allowed: boolean
  min_order_lead_minutes: number
  tax_type: string | null
  display_order: number
  is_takeout: boolean
  is_ec: boolean
  daily_max_quantity: number | null
  preparation_days: number
  custom_options: ProductCustomOption[]
  noshi_enabled: boolean
  noshi_ids: string[]
  print_decoration_enabled: boolean
  tags: string[] | null
  minVariantPrice?: number
  shipping_method: string | null
  storage_method: string | null
  ingredients: string | null
  best_before_days: number | null
  content_quantity: string | null
  limited_from: string | null
  limited_until: string | null
  created_at: string | null
  updated_at: string | null
  isMasterProduct?: boolean
}

interface UseProductRegistrationsOptions {
  storeId?: string
  publishedOnly?: boolean
}

function normalizeCustomOptions(raw: unknown): ProductCustomOption[] {
  if (!Array.isArray(raw)) return []
  return raw
    .filter((o): o is Record<string, any> => o !== null && typeof o === "object")
    .map((o) => ({
      name: String(o.name ?? ""),
      type: (o.type === "multiple" || o.type === "text") ? o.type : "single",
      required: Boolean(o.required),
      values: Array.isArray(o.values)
        ? o.values
            .filter((v: any) => v && typeof v === "object")
            .map((v: any) => ({
              label: String(v.label ?? ""),
              additional_price: Number(v.additional_price) || 0,
            }))
        : [],
    }))
}

function mapRow(row: any): ProductRegistration {
  const variants: any[] = row.product_variants ?? [];
  const activePrices = variants
    .filter((v) => v.is_active !== false)
    .map((v) => Number(v.price) || 0)
    .filter((p) => p > 0);
  const minVariantPrice = activePrices.length > 0 ? Math.min(...activePrices) : undefined;
  return {
    id: row.id,
    store_id: row.store_id ?? "",
    name: row.name ?? "",
    description: row.description ?? "",
    base_price: row.base_price ?? 0,
    image: row.image ?? null,
    cross_section_image: row.cross_section_image ?? null,
    category_name: row.category_name ?? null,
    is_active: row.is_active ?? true,
    is_preorder_required: row.is_preorder_required ?? false,
    same_day_order_allowed: row.same_day_order_allowed ?? false,
    min_order_lead_minutes: row.min_order_lead_minutes ?? 0,
    tax_type: row.tax_type ?? null,
    display_order: row.display_order ?? 0,
    is_takeout: row.is_takeout ?? true,
    is_ec: row.is_ec ?? false,
    daily_max_quantity: row.daily_max_quantity ?? null,
    preparation_days: row.preparation_days ?? 0,
    custom_options: normalizeCustomOptions(row.custom_options),
    noshi_enabled: row.noshi_enabled ?? false,
    noshi_ids: Array.isArray(row.noshi_ids) ? row.noshi_ids : [],
    print_decoration_enabled: row.print_decoration_enabled ?? false,
    tags: Array.isArray(row.tags) ? row.tags : null,
    minVariantPrice,
    shipping_method: row.shipping_method ?? null,
    storage_method: row.storage_method ?? null,
    ingredients: row.ingredients ?? null,
    best_before_days: row.best_before_days ?? null,
    content_quantity: row.content_quantity ?? null,
    limited_from: row.limited_from ?? null,
    limited_until: row.limited_until ?? null,
    created_at: row.created_at ?? null,
    updated_at: row.updated_at ?? null,
  }
}

export function useProductRegistrations(options: UseProductRegistrationsOptions = {}) {
  const [products, setProducts] = useState<ProductRegistration[]>([])
  const [categories, setCategories] = useState<string[]>(["すべて"])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchProducts = useCallback(async (silent = false) => {
    if (!options.storeId) {
      setProducts([])
      setCategories(["すべて"])
      setLoading(false)
      return
    }
    if (!silent) setLoading(true)
    setError(null)

    const storeIds = [options.storeId]
    let parentStoreId: string | null = null
    const { data: storeData } = await supabase
      .from("stores")
      .select("parent_store_id")
      .eq("id", options.storeId)
      .single()
    if (storeData?.parent_store_id) {
      parentStoreId = storeData.parent_store_id
      storeIds.push(parentStoreId)
    }

    let query = supabase
      .from("products")
      .select("*, product_variants(id, price, is_active)")
      .in("store_id", storeIds)
      .order("display_order", { ascending: true })
      .order("category_name", { ascending: true })
      .order("base_price", { ascending: true })
      .order("created_at", { ascending: true })

    if (options.publishedOnly) {
      query = query.eq("is_active", true)
    }

    const { data, error: err } = await query
    if (err) {
      setError(err.message)
    } else {
      const categorySet = new Set<string>()
      const mapped = (data ?? []).map((row: any) => {
        const p = mapRow(row)
        p.isMasterProduct = parentStoreId !== null && row.store_id === parentStoreId
        if (p.category_name) categorySet.add(p.category_name)
        return p
      })
      setProducts(mapped)
      setCategories(["すべて", ...Array.from(categorySet)])
    }
    setLoading(false)
  }, [options.storeId, options.publishedOnly])

  useEffect(() => {
    fetchProducts()
  }, [fetchProducts])

  const updateProduct = async (
    id: string,
    updates: Partial<Omit<ProductRegistration, "id" | "store_id">>
  ) => {
    const payload: any = {}
    if (updates.name !== undefined) payload.name = updates.name
    if (updates.description !== undefined) payload.description = updates.description
    if (updates.base_price !== undefined) payload.base_price = updates.base_price
    if (updates.image !== undefined) payload.image = updates.image
    if (updates.cross_section_image !== undefined) payload.cross_section_image = updates.cross_section_image
    if (updates.category_name !== undefined) payload.category_name = updates.category_name
    if (updates.is_active !== undefined) payload.is_active = updates.is_active
    if (updates.is_preorder_required !== undefined) payload.is_preorder_required = updates.is_preorder_required
    if (updates.same_day_order_allowed !== undefined) payload.same_day_order_allowed = updates.same_day_order_allowed
    if (updates.min_order_lead_minutes !== undefined) payload.min_order_lead_minutes = updates.min_order_lead_minutes
    if (updates.tax_type !== undefined) payload.tax_type = updates.tax_type
    if (updates.display_order !== undefined) payload.display_order = updates.display_order
    if (updates.is_takeout !== undefined) payload.is_takeout = updates.is_takeout
    if (updates.is_ec !== undefined) payload.is_ec = updates.is_ec
    if (updates.daily_max_quantity !== undefined) payload.daily_max_quantity = updates.daily_max_quantity
    if (updates.preparation_days !== undefined) payload.preparation_days = updates.preparation_days
    if (updates.custom_options !== undefined) payload.custom_options = updates.custom_options
    if (updates.print_decoration_enabled !== undefined) payload.print_decoration_enabled = updates.print_decoration_enabled
    if (updates.noshi_enabled !== undefined) payload.noshi_enabled = updates.noshi_enabled
    if (updates.noshi_ids !== undefined) payload.noshi_ids = updates.noshi_ids
    if (updates.limited_from !== undefined) payload.limited_from = updates.limited_from
    if (updates.limited_until !== undefined) payload.limited_until = updates.limited_until
    if (updates.tags !== undefined) payload.tags = updates.tags
    if (updates.same_day_order_allowed !== undefined) payload.same_day_order_allowed = updates.same_day_order_allowed
    if (updates.cross_section_image !== undefined) payload.cross_section_image = updates.cross_section_image
    if (updates.shipping_method !== undefined) payload.shipping_method = updates.shipping_method
    if (updates.storage_method !== undefined) payload.storage_method = updates.storage_method
    if (updates.ingredients !== undefined) payload.ingredients = updates.ingredients
    if (updates.best_before_days !== undefined) payload.best_before_days = updates.best_before_days
    if (updates.content_quantity !== undefined) payload.content_quantity = updates.content_quantity

    const { error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", id)

    if (!error) await fetchProducts(true)
    return { error: error?.message || null }
  }

  const deleteProduct = async (id: string) => {
    const { data: variants } = await supabase.from("product_variants").select("id").eq("product_id", id)
    const variantIds = (variants ?? []).map((v: any) => v.id)
    await supabase.from("order_items").update({ product_id: null, product_variant_id: null }).eq("product_id", id)
    if (variantIds.length > 0) {
      await supabase.from("order_items").update({ product_variant_id: null }).in("product_variant_id", variantIds)
    }
    await supabase.from("product_decoration_groups").delete().eq("product_id", id)
    await supabase.from("product_variants").delete().eq("product_id", id)
    const { error } = await supabase.from("products").delete().eq("id", id)

    if (!error) await fetchProducts()
    return { error: error?.message || null }
  }

  return {
    products,
    categories,
    loading,
    error,
    refetch: fetchProducts,
    updateProduct,
    deleteProduct,
  }
}

export function useProductRegistration(id?: string) {
  const [product, setProduct] = useState<ProductRegistration | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (!id) {
      setProduct(null)
      setLoading(false)
      return
    }
    setLoading(true)
    setError(null)

    supabase
      .from("products")
      .select("*")
      .eq("id", id)
      .maybeSingle()
      .then(({ data, error: err }) => {
        if (err) {
          setError(err.message)
        } else if (data) {
          setProduct(mapRow(data))
        } else {
          setProduct(null)
        }
        setLoading(false)
      })
  }, [id])

  return { product, loading, error }
}
