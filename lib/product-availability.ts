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
  const { data } = await supabase
    .from("order_items")
    .select("product_id, quantity, orders!inner(order_status)")
    .in("product_id", productIds)
    .neq("orders.order_status", "cancelled")

  const result: Record<string, number> = {}
  for (const row of (data ?? []) as { product_id: string | null; quantity: number }[]) {
    if (!row.product_id) continue
    result[row.product_id] = (result[row.product_id] ?? 0) + (Number(row.quantity) || 0)
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
  const { data } = await supabase
    .from("order_items")
    .select("product_id, quantity, orders!inner(order_status, pickup_date)")
    .in("product_id", productIds)
    .gte("orders.pickup_date", fromDate)
    .lte("orders.pickup_date", toDate)
    .neq("orders.order_status", "cancelled")

  const result: Record<string, number> = {}
  for (const row of (data ?? []) as { product_id: string | null; quantity: number; orders: { pickup_date: string | null } }[]) {
    const pickupDate = row.orders?.pickup_date
    if (!row.product_id || !pickupDate) continue
    const key = `${row.product_id}|${pickupDate}`
    result[key] = (result[key] ?? 0) + (Number(row.quantity) || 0)
  }
  return result
}
