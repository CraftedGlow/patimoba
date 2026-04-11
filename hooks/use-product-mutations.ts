"use client"

import { supabase } from "@/lib/supabase"
import type { ShippingType, StorageType } from "@/lib/types"

interface CreateProductInput {
  storeId: string
  name: string
  description: string
  price: number
  image?: string
  categoryId?: string | null
  category?: string
  maxPerOrder?: number
  maxPerDay?: number
  acceptOrders?: boolean
  todayAvailable?: boolean
  prepDays?: number
  isEc?: boolean
  decoration?: boolean
  orderStartDate?: string | null
  orderEndDate?: string | null
  ingredients?: string
  storageType?: StorageType | null
  shippingType?: ShippingType | null
  expirationDays?: number
  sortOrder?: number
}

interface UpdateProductInput {
  name?: string
  description?: string
  price?: number
  image?: string
  categoryId?: string | null
  category?: string
  maxPerOrder?: number
  maxPerDay?: number
  acceptOrders?: boolean
  todayAvailable?: boolean
  prepDays?: number
  isEc?: boolean
  orderStartDate?: string | null
  orderEndDate?: string | null
  ingredients?: string
  storageType?: StorageType | null
  shippingType?: ShippingType | null
  expirationDays?: number
  sortOrder?: number
}

export function useProductMutations() {
  const createProduct = async (input: CreateProductInput) => {
    const { data, error } = await supabase
      .from("products")
      .insert({
        store_id: input.storeId,
        name: input.name,
        description: input.description,
        price: input.price,
        image: input.image,
        category_id: input.categoryId ?? null,
        category: input.category ?? "",
        max_per_order: input.maxPerOrder ?? 10,
        max_per_day: input.maxPerDay ?? 30,
        accept_orders: input.acceptOrders ?? true,
        today_available: input.todayAvailable ?? true,
        prep_days: input.prepDays ?? 0,
        is_ec: input.isEc ?? false,
        decoration: input.decoration ?? false,
        order_start_date: input.orderStartDate ?? null,
        order_end_date: input.orderEndDate ?? null,
        ingredients: input.ingredients ?? "",
        storage_type: input.storageType ?? "",
        shipping_type: input.shippingType ?? "",
        expiration_days: input.expirationDays ?? 0,
        sort_order: input.sortOrder ?? 0,
      })
      .select("id")
      .single()

    return { productId: data ? String(data.id) : "", error: error?.message || null }
  }

  const updateProduct = async (productId: string, input: UpdateProductInput) => {
    const payload: any = {}
    if (input.name !== undefined) payload.name = input.name
    if (input.description !== undefined) payload.description = input.description
    if (input.price !== undefined) payload.price = input.price
    if (input.image !== undefined) payload.image = input.image
    if (input.categoryId !== undefined) payload.category_id = input.categoryId
    if (input.category !== undefined) payload.category = input.category
    if (input.maxPerOrder !== undefined) payload.max_per_order = input.maxPerOrder
    if (input.maxPerDay !== undefined) payload.max_per_day = input.maxPerDay
    if (input.acceptOrders !== undefined) payload.accept_orders = input.acceptOrders
    if (input.todayAvailable !== undefined) payload.today_available = input.todayAvailable
    if (input.prepDays !== undefined) payload.prep_days = input.prepDays
    if (input.isEc !== undefined) payload.is_ec = input.isEc
    if (input.orderStartDate !== undefined) payload.order_start_date = input.orderStartDate
    if (input.orderEndDate !== undefined) payload.order_end_date = input.orderEndDate
    if (input.ingredients !== undefined) payload.ingredients = input.ingredients
    if (input.storageType !== undefined) payload.storage_type = input.storageType
    if (input.shippingType !== undefined) payload.shipping_type = input.shippingType
    if (input.expirationDays !== undefined) payload.expiration_days = input.expirationDays
    if (input.sortOrder !== undefined) payload.sort_order = input.sortOrder

    const { error } = await supabase
      .from("products")
      .update(payload)
      .eq("id", productId)

    return { error: error?.message || null }
  }

  const toggleAcceptOrders = async (productId: string, accept: boolean) => {
    const { error } = await supabase
      .from("products")
      .update({ accept_orders: accept })
      .eq("id", productId)
    return { error: error?.message || null }
  }

  const toggleTodayAvailable = async (productId: string, available: boolean) => {
    const { error } = await supabase
      .from("products")
      .update({ today_available: available })
      .eq("id", productId)
    return { error: error?.message || null }
  }

  const togglePublished = async (productId: string, published: boolean) => {
    const { error } = await supabase
      .from("products")
      .update({ accept_orders: published })
      .eq("id", productId)
    return { error: error?.message || null }
  }

  const deleteProduct = async (productId: string) => {
    const { error } = await supabase
      .from("products")
      .delete()
      .eq("id", productId)
    return { error: error?.message || null }
  }

  return {
    createProduct,
    updateProduct,
    toggleAcceptOrders,
    toggleTodayAvailable,
    togglePublished,
    deleteProduct,
  }
}
