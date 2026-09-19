export interface CandleChargeEntry {
  candleOptionId: string
  price: number
  quantity: number
  freeQuantity?: number
}

/**
 * candleOptionIdごとに数量を集計してから無料個数を差し引く。
 * 同じろうそく種類が複数行（例: ナンバーキャンドルの数字違い）に分かれていても無料が二重適用されない。
 */
export function calcCandleTotal(entries: CandleChargeEntry[]): number {
  const groups = new Map<string, { price: number; qty: number; free: number }>()
  for (const e of entries) {
    if (!e.candleOptionId || e.quantity <= 0) continue
    const g = groups.get(e.candleOptionId) ?? { price: e.price, qty: 0, free: e.freeQuantity ?? 0 }
    g.qty += e.quantity
    groups.set(e.candleOptionId, g)
  }
  let total = 0
  Array.from(groups.values()).forEach((g) => {
    total += Math.max(0, g.qty - g.free) * g.price
  })
  return total
}

/**
 * 注文確定時、行ごとに「この行で何個分が無料になったか」を決定論的に割り振る。
 * 同一candleOptionIdの行はまとめて1つの無料枠を消費するため、行の並び順によらず合計金額は一致する。
 */
export function allocateCandleFreeQuantity<T extends CandleChargeEntry>(
  entries: T[]
): (T & { usedFree: number })[] {
  const remaining = new Map<string, number>()
  return entries.map((e) => {
    if (!e.candleOptionId || e.quantity <= 0) return { ...e, usedFree: 0 }
    if (!remaining.has(e.candleOptionId)) remaining.set(e.candleOptionId, e.freeQuantity ?? 0)
    const free = remaining.get(e.candleOptionId)!
    const usedFree = Math.min(free, e.quantity)
    remaining.set(e.candleOptionId, free - usedFree)
    return { ...e, usedFree }
  })
}
