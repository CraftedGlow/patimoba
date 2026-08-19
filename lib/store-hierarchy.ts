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
