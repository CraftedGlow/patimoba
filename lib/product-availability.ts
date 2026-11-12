// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any

/**
 * 複数商品の、キャンセルを除いた累計予約数量をまとめて取得する（商品ID -> 数量）。
 * products.max_total_quantity（期間全体の上限）との比較に使う。
 */
export async function getProductsTotalQuantitySold(
  supabase: SupabaseLike,
  productIds: string[]
): Promise<Record<string, number>> {
  if (productIds.length === 0) return {}
  // お客様のセッション（anonキー）は自分自身の注文しかRLSで見えないため、全顧客分の
  // 集計値のみを返す SECURITY DEFINER の RPC 経由で取得する（supabase/migrations/20261112000100）
  const { data } = await supabase.rpc("get_products_sold_quantity", { p_product_ids: productIds })

  const result: Record<string, number> = {}
  for (const row of (data ?? []) as { product_id: string; total_quantity: number }[]) {
    result[row.product_id] = Number(row.total_quantity) || 0
  }
  return result
}

/**
 * 複数商品について、指定の日付範囲内の受取日ごとの（キャンセルを除いた）予約数量をまとめて取得する。
 * products.daily_max_quantity（1日あたりの上限）との比較に使う。
 * 戻り値のキーは `${productId}|${pickupDate}`。
 */
export async function getProductsQuantitySoldByDate(
  supabase: SupabaseLike,
  productIds: string[],
  fromDate: string,
  toDate: string
): Promise<Record<string, number>> {
  if (productIds.length === 0) return {}
  // 上と同じ理由で、全顧客分の受取日ごとの集計値を RPC 経由で取得する
  const { data } = await supabase.rpc("get_products_sold_quantity_by_date", {
    p_product_ids: productIds,
    p_from_date: fromDate,
    p_to_date: toDate,
  })

  const result: Record<string, number> = {}
  for (const row of (data ?? []) as { product_id: string; pickup_date: string; total_quantity: number }[]) {
    const key = `${row.product_id}|${row.pickup_date}`
    result[key] = Number(row.total_quantity) || 0
  }
  return result
}
