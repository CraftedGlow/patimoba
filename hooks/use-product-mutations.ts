"use client"

import { supabase } from "@/lib/supabase"

interface CreateProductInput {
  storeId: string
  name: string
  description: string
  basePrice: number
  image?: string
  categoryName?: string | null
  isActive?: boolean
  sameDayOrderAllowed?: boolean
  isPreorderRequired?: boolean
  minOrderLeadMinutes?: number
  taxType?: string | null
  displayOrder?: number
}

interface UpdateProductInput {
  name?: string
  description?: string
  basePrice?: number
  image?: string
  categoryName?: string | null
  isActive?: boolean
  sameDayOrderAllowed?: boolean
  isPreorderRequired?: boolean
  minOrderLeadMinutes?: number
  taxType?: string | null
  displayOrder?: number
}

export function useProductMutations() {
  const createProduct = async (input: CreateProductInput) => {
    const { data, error } = await supabase
      .from("products")
      .insert({
        store_id: input.storeId,
        name: input.name,
        description: input.description,
        base_price: input.basePrice,
        image: input.image ?? "",
        category_name: input.categoryName ?? null,
        is_active: input.isActive ?? true,
        same_day_order_allowed: input.sameDayOrderAllowed ?? false,
        is_preorder_required: input.isPreorderRequired ?? false,
        min_order_lead_minutes: input.minOrderLeadMinutes ?? 0,
        tax_type: input.taxType ?? "included",
        display_order: input.displayOrder ?? 0,
      })
      .select("id")
      .single()

    return { productId: data ? String(data.id) : "", error: error?.message || null }
  }

  const updateProduct = async (productId: string, input: UpdateProductInput) => {
    const payload: any = {}
    if (input.name !== undefined) payload.name = input.name
    if (input.description !== undefined) payload.description = input.description
    if (input.basePrice !== undefined) payload.base_price = input.basePrice
    if (input.image !== undefined) payload.image = input.image
    if (input.categoryName !== undefined) payload.category_name = input.categoryName
    if (input.isActive !== undefined) payload.is_active = input.isActive
    if (input.sameDayOrderAllowed !== undefined) payload.same_day_order_allowed = input.sameDayOrderAllowed
    if (input.isPreorderRequired !== undefined) payload.is_preorder_required = input.isPreorderRequired
    if (input.minOrderLeadMinutes !== undefined) payload.min_order_lead_minutes = input.minOrderLeadMinutes
    if (input.taxType !== undefined) payload.tax_type = input.taxType
    if (input.displayOrder !== undefined) payload.display_order = input.displayOrder

    const { error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", productId)

    return { error: error?.message || null }
  }

  const toggleActive = async (productId: string, active: boolean) => {
    const { error } = await supabase
      .from("products")
      .update({ is_active: active })
      .eq("id", productId)
    return { error: error?.message || null }
  }

  const deleteProduct = async (productId: string) => {
    // まず product_variants を削除
    await supabase.from("product_variants").delete().eq("product_id", productId)
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId)
    return { error: error?.message || null }
  }

  return {
    createProduct,
    updateProduct,
    toggleActive,
    deleteProduct,
  }
}
