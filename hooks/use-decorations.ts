"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import type { DecorationItem } from "@/lib/types"

function toDecorationItem(row: any): DecorationItem {
  return {
    id: String(row.id),
    name: row.name || "",
    description: row.description ?? null,
    imageUrl: row.image_url ?? null,
    category: row.category || "other",
    price: Number(row.price) || 0,
    isSeasonal: Boolean(row.is_seasonal),
    seasonStart: row.season_start ?? null,
    seasonEnd: row.season_end ?? null,
    preparationDays: row.preparation_days != null ? Number(row.preparation_days) : null,
    displayOrder: Number(row.display_order) || 0,
  }
}

export function useDecorations(storeId?: string) {
  const [decorations, setDecorations] = useState<DecorationItem[]>([])
  const [loading, setLoading] = useState(true)

  const fetchDecorations = useCallback(async () => {
    if (!storeId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from("decorations")
      .select("*")
      .eq("store_id", storeId)
      .order("display_order", { ascending: true })
    setDecorations((data ?? []).map(toDecorationItem))
    setLoading(false)
  }, [storeId])

  useEffect(() => { fetchDecorations() }, [fetchDecorations])

  const createDecoration = async (
    storeId: string,
    data: {
      name: string
      description?: string
      imageUrl?: string
      category: string
      price: number
      isSeasonal?: boolean
      seasonStart?: string | null
      seasonEnd?: string | null
      preparationDays?: number | null
    }
  ): Promise<{ error: string | null }> => {
    const { error } = await supabase.from("decorations").insert({
      store_id: storeId,
      name: data.name,
      description: data.description ?? null,
      image_url: data.imageUrl ?? null,
      category: data.category,
      price: data.price,
      is_seasonal: data.isSeasonal ?? false,
      season_start: data.seasonStart ?? null,
      season_end: data.seasonEnd ?? null,
      preparation_days: data.preparationDays ?? null,
    })
    if (!error) await fetchDecorations()
    return { error: error?.message ?? null }
  }

  const updateDecoration = async (
    id: string,
    data: Partial<{
      name: string
      description: string | null
      imageUrl: string | null
      category: string
      price: number
      isActive: boolean
      isSeasonal: boolean
      seasonStart: string | null
      seasonEnd: string | null
      preparationDays: number | null
    }>
  ): Promise<{ error: string | null }> => {
    const payload: any = {}
    if (data.name !== undefined) payload.name = data.name
    if (data.description !== undefined) payload.description = data.description
    if (data.imageUrl !== undefined) payload.image_url = data.imageUrl
    if (data.category !== undefined) payload.category = data.category
    if (data.price !== undefined) payload.price = data.price
    if (data.isActive !== undefined) payload.is_active = data.isActive
    if (data.isSeasonal !== undefined) payload.is_seasonal = data.isSeasonal
    if (data.seasonStart !== undefined) payload.season_start = data.seasonStart
    if (data.seasonEnd !== undefined) payload.season_end = data.seasonEnd
    if (data.preparationDays !== undefined) payload.preparation_days = data.preparationDays
    payload.updated_at = new Date().toISOString()

    const { error } = await supabase.from("decorations").update(payload).eq("id", id)
    if (!error) await fetchDecorations()
    return { error: error?.message ?? null }
  }

  const deleteDecoration = async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from("decorations").delete().eq("id", id)
    if (!error) await fetchDecorations()
    return { error: error?.message ?? null }
  }

  return { decorations, loading, refetch: fetchDecorations, createDecoration, updateDecoration, deleteDecoration }
}
