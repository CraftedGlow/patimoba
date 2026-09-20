import { calcCandleTotal, type CandleChargeEntry } from "./candle-pricing"

export interface PricedCartItem {
  price: number
  quantity: number
  customization?: {
    sizePrice?: number
    candles?: CandleChargeEntry[]
    options?: { price: number }[]
    customOptions?: { additionalPrice: number }[]
    noshi?: { price: number }
    messagePlateOption?: { price: number }
  }
}

/**
 * カート内商品1行分の合計金額（数量込み）を計算する唯一の関数。
 * カート・確認画面・注文作成APIなど金額を扱うすべての箇所からここを呼ぶことで、
 * メッセージプレート代などの加算漏れが特定の箇所だけで発生するのを防ぐ。
 */
export function calcItemSubtotal(item: PricedCartItem): number {
  const c = item.customization
  if (!c) return item.price * item.quantity
  const candleSum = calcCandleTotal(c.candles || [])
  const optionSum = (c.options || []).reduce((s, op) => s + op.price, 0)
  const customOptionSum = (c.customOptions || []).reduce((s, o) => s + (o.additionalPrice || 0), 0)
  const noshiPrice = c.noshi?.price ?? 0
  const messagePlatePrice = c.messagePlateOption?.price ?? 0
  return (
    item.price * item.quantity +
    ((c.sizePrice ?? 0) + candleSum + optionSum + customOptionSum + noshiPrice + messagePlatePrice) * item.quantity
  )
}
