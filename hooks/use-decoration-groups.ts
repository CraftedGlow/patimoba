"use client"

import { useState, useEffect, useCallback } from "react"
import { supabase } from "@/lib/supabase"
import type { DecorationGroupWithItems, DecorationItem } from "@/lib/types"

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

function toGroupWithItems(row: any): DecorationGroupWithItems {
  const items: DecorationItem[] = (row.decoration_group_items ?? [])
    .sort((a: any, b: any) => (a.display_order ?? 0) - (b.display_order ?? 0))
    .map((gi: any) => gi.decorations ? toDecorationItem(gi.decorations) : null)
    .filter(Boolean)
  return {
    id: String(row.id),
    storeId: String(row.store_id),
    name: row.name || "",
    description: row.description ?? null,
    selectionType: row.selection_type === "multiple" ? "multiple" : "single",
    maxSelections: row.max_selections ?? null,
    required: Boolean(row.required),
    preparationDays: row.preparation_days != null ? Number(row.preparation_days) : null,
    displayOrder: Number(row.display_order) || 0,
    items,
  }
}

const GROUP_SELECT = `
  id, store_id, name, description, selection_type, max_selections, required, preparation_days, display_order,
  decoration_group_items (
    id, display_order, decoration_id,
    decorations ( id, name, description, image_url, category, price, is_seasonal, season_start, season_end, display_order )
  )
`

export function useDecorationGroups(storeId?: string) {
  const [groups, setGroups] = useState<DecorationGroupWithItems[]>([])
  const [loading, setLoading] = useState(true)

  const fetchGroups = useCallback(async () => {
    if (!storeId) { setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from("decoration_groups")
      .select(GROUP_SELECT)
      .eq("store_id", storeId)
      .order("display_order", { ascending: true })
    setGroups((data ?? []).map(toGroupWithItems))
    setLoading(false)
  }, [storeId])

  useEffect(() => { fetchGroups() }, [fetchGroups])

  const createGroup = async (
    storeId: string,
    data: {
      name: string
      description?: string
      selectionType: "single" | "multiple"
      maxSelections?: number | null
      required?: boolean
      preparationDays?: number | null
    }
  ): Promise<{ id: string | null; error: string | null }> => {
    const { data: row, error } = await supabase
      .from("decoration_groups")
      .insert({
        store_id: storeId,
        name: data.name,
        description: data.description ?? null,
        selection_type: data.selectionType,
        max_selections: data.maxSelections ?? null,
        required: data.required ?? false,
        preparation_days: data.preparationDays ?? null,
      })
      .select("id")
      .single()
    if (!error) await fetchGroups()
    return { id: row?.id ?? null, error: error?.message ?? null }
  }

  const updateGroup = async (
    id: string,
    data: Partial<{
      name: string
      description: string | null
      selectionType: "single" | "multiple"
      maxSelections: number | null
      required: boolean
      preparationDays: number | null
    }>
  ): Promise<{ error: string | null }> => {
    const payload: any = { updated_at: new Date().toISOString() }
    if (data.name !== undefined) payload.name = data.name
    if (data.description !== undefined) payload.description = data.description
    if (data.selectionType !== undefined) payload.selection_type = data.selectionType
    if (data.maxSelections !== undefined) payload.max_selections = data.maxSelections
    if (data.required !== undefined) payload.required = data.required
    if (data.preparationDays !== undefined) payload.preparation_days = data.preparationDays
    const { error } = await supabase.from("decoration_groups").update(payload).eq("id", id)
    if (!error) await fetchGroups()
    return { error: error?.message ?? null }
  }

  const deleteGroup = async (id: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from("decoration_groups").delete().eq("id", id)
    if (!error) await fetchGroups()
    return { error: error?.message ?? null }
  }

  const addItemToGroup = async (groupId: string, decorationId: string): Promise<{ error: string | null }> => {
    const { error } = await supabase.from("decoration_group_items").insert({
      group_id: groupId,
      decoration_id: decorationId,
    })
    if (!error) await fetchGroups()
    return { error: error?.message ?? null }
  }

  const removeItemFromGroup = async (groupId: string, decorationId: string): Promise<{ error: string | null }> => {
    const { error } = await supabase
      .from("decoration_group_items")
      .delete()
      .eq("group_id", groupId)
      .eq("decoration_id", decorationId)
    if (!error) await fetchGroups()
    return { error: error?.message ?? null }
  }

  return {
    groups,
    loading,
    refetch: fetchGroups,
    createGroup,
    updateGroup,
    deleteGroup,
    addItemToGroup,
    removeItemFromGroup,
  }
}

// 商品に紐付いたグループを取得
export function useProductDecorationGroups(productId?: string) {
  const [groups, setGroups] = useState<DecorationGroupWithItems[]>([])
  const [loading, setLoading] = useState(true)

  const fetchGroupsForProduct = useCallback(async () => {
    if (!productId) { setGroups([]); setLoading(false); return }
    setLoading(true)
    const { data } = await supabase
      .from("product_decoration_groups")
      .select(`
        display_order,
        decoration_groups (
          ${GROUP_SELECT}
        )
      `)
      .eq("product_id", productId)
      .order("display_order", { ascending: true })

    const result: DecorationGroupWithItems[] = (data ?? [])
      .map((row: any) => row.decoration_groups ? toGroupWithItems(row.decoration_groups) : null)
      .filter((g): g is DecorationGroupWithItems => g !== null)
    setGroups(result)
    setLoading(false)
  }, [productId])

  useEffect(() => { fetchGroupsForProduct() }, [fetchGroupsForProduct])

  return { groups, loading, refetch: fetchGroupsForProduct }
}

// 商品のグループ紐付けを一括更新（既存を削除して新規挿入）
export async function setProductDecorationGroups(
  productId: string,
  groupIds: string[]
): Promise<{ error: string | null }> {
  const { error: delErr } = await supabase
    .from("product_decoration_groups")
    .delete()
    .eq("product_id", productId)
  if (delErr) return { error: delErr.message }

  if (groupIds.length === 0) return { error: null }

  const rows = groupIds.map((gid, i) => ({
    product_id: productId,
    group_id: gid,
    display_order: i,
  }))
  const { error: insErr } = await supabase.from("product_decoration_groups").insert(rows)
  return { error: insErr?.message ?? null }
}

// 商品に紐付いているグループIDリストを取得
export async function getProductGroupIds(productId: string): Promise<string[]> {
  const { data } = await supabase
    .from("product_decoration_groups")
    .select("group_id")
    .eq("product_id", productId)
  return (data ?? []).map((r: any) => String(r.group_id))
}
