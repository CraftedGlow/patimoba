import { supabase } from "@/lib/supabase"

/**
 * 子店舗の場合、親（マスター）店舗のIDも含めて返す。
 * マスターが登録した商品・デコレーション・のし・袋等を子店舗側で共有表示するために使う。
 */
export async function getStoreIdsWithParent(
  storeId: string
): Promise<{ storeIds: string[]; parentStoreId: string | null }> {
  const { data } = await supabase
    .from("stores")
    .select("parent_store_id")
    .eq("id", storeId)
    .single()
  const parentStoreId = data?.parent_store_id ?? null
  const storeIds = parentStoreId ? [storeId, parentStoreId] : [storeId]
  return { storeIds, parentStoreId }
}

export interface ProductStoreOverride {
  is_active: boolean | null
  same_day_order_allowed: boolean | null
  daily_max_quantity: number | null
  preparation_days: number | null
  available_days_of_month: number[] | null
  payment_method_restriction: string | null
}

/**
 * 共有商品（マスター登録）の受付状況・当日受付・最大個数・準備日数・毎月の受け取り可能日・
 * 決済方法制限は、この店舗専用の上書き設定（product_store_overrides）があればそちらを優先する。
 * parentStoreId が null（=マスター自身の閲覧）の場合は上書きの概念がないため空で返す。
 */
export async function fetchProductStoreOverrides(
  storeId: string,
  parentStoreId: string | null
): Promise<Map<string, ProductStoreOverride>> {
  const map = new Map<string, ProductStoreOverride>()
  if (parentStoreId === null) return map
  const { data } = await supabase
    .from("product_store_overrides")
    .select("product_id, is_active, same_day_order_allowed, daily_max_quantity, preparation_days, available_days_of_month, payment_method_restriction")
    .eq("store_id", storeId)
  for (const row of data ?? []) {
    map.set(row.product_id, {
      is_active: row.is_active,
      same_day_order_allowed: row.same_day_order_allowed,
      daily_max_quantity: row.daily_max_quantity,
      preparation_days: row.preparation_days,
      available_days_of_month: row.available_days_of_month,
      payment_method_restriction: row.payment_method_restriction,
    })
  }
  return map
}

/** 共有商品の行に、この店舗の上書き値をマージする（自店舗登録の商品はそのまま） */
export function applyProductStoreOverride<
  T extends {
    store_id: string
    is_active?: boolean
    same_day_order_allowed?: boolean
    daily_max_quantity?: number | null
    preparation_days?: number
    available_days_of_month?: number[] | null
    payment_method_restriction?: string | null
  }
>(row: T, productId: string, parentStoreId: string | null, overrides: Map<string, ProductStoreOverride>): T {
  if (parentStoreId === null || row.store_id !== parentStoreId) return row
  const ov = overrides.get(productId)
  if (!ov) return row
  return {
    ...row,
    is_active: ov.is_active ?? row.is_active,
    same_day_order_allowed: ov.same_day_order_allowed ?? row.same_day_order_allowed,
    daily_max_quantity: ov.daily_max_quantity !== null ? ov.daily_max_quantity : row.daily_max_quantity,
    preparation_days: ov.preparation_days ?? row.preparation_days,
    available_days_of_month: ov.available_days_of_month ?? row.available_days_of_month,
    payment_method_restriction: ov.payment_method_restriction ?? row.payment_method_restriction,
  }
}

/** is_active/same_day_order_allowed/daily_max_quantity/preparation_days/available_days_of_month/payment_method_restriction の上書きを保存する */
export async function upsertProductStoreOverride(
  productId: string,
  storeId: string,
  updates: Partial<ProductStoreOverride>
): Promise<{ error: string | null }> {
  const { data: existing } = await supabase
    .from("product_store_overrides")
    .select("id")
    .eq("product_id", productId)
    .eq("store_id", storeId)
    .maybeSingle()
  if (existing) {
    const { error } = await supabase
      .from("product_store_overrides")
      .update(updates)
      .eq("id", existing.id)
    return { error: error?.message ?? null }
  }
  const { error } = await supabase
    .from("product_store_overrides")
    .insert({ product_id: productId, store_id: storeId, ...updates })
  return { error: error?.message ?? null }
}
