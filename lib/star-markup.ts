export interface ReceiptItem {
  name: string
  quantity: number
  subtotal: number
  variantName?: string | null
  options?: Array<{
    groupName?: string | null
    itemName?: string | null
    priceDelta?: number | null
    quantity?: number | null
  }>
}

export interface ReceiptData {
  storeName: string
  orderNo?: string | null
  pickupDate?: string | null
  pickupTime?: string | null
  customerName?: string | null
  items: ReceiptItem[]
  subtotal: number
  discountAmount?: number | null
  totalAmount: number
}

const SEP = "----------------------------------------"

function fmtDate(d?: string | null, t?: string | null): string {
  const parts: string[] = []
  if (d) {
    const dt = new Date(d)
    parts.push(
      `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}`
    )
  }
  if (t) parts.push(t)
  return parts.join(" ")
}

// Star Document Markup (text/vnd.star.markup) はブラケット形式のみサポート
// https://star-m.jp/products/s_print/CloudPRNTSDK/Documentation/en/articles/markup/markupintro.html
export function buildReceiptMarkup(data: ReceiptData): string {
  const lines: string[] = []
  const push = (...s: string[]) => lines.push(...s)

  // 店名 - 3倍サイズ・太字・中央揃え
  push(
    "[align: center]",
    "[bold: on]",
    "[magnify: width 3; height 3]",
    data.storeName,
    "[magnify]",
    "[bold: off]",
    SEP,
    "[align: left]",
  )

  if (data.orderNo) push(`注文番号: #${data.orderNo}`)

  const dt = fmtDate(data.pickupDate, data.pickupTime)
  if (dt) push(`受取日時: ${dt}`)

  if (data.customerName) push(`お名前: ${data.customerName}`)

  push(SEP)

  for (const item of data.items) {
    push(item.name)
    push(`  x${item.quantity}  ¥${item.subtotal.toLocaleString()}`)
    if (item.variantName) push(`  (${item.variantName})`)
    for (const opt of item.options ?? []) {
      if (!opt.itemName) continue
      const qty = (opt.quantity ?? 0) > 1 ? ` x${opt.quantity}` : ""
      const price =
        opt.priceDelta && opt.priceDelta !== 0
          ? `  +¥${opt.priceDelta.toLocaleString()}`
          : ""
      push(`  ${opt.groupName}: ${opt.itemName}${qty}${price}`)
    }
  }

  push(SEP)
  push(`小計: ¥${data.subtotal.toLocaleString()}`)
  if (data.discountAmount && data.discountAmount > 0) {
    push(`ポイント利用: -¥${data.discountAmount.toLocaleString()}`)
  }
  push(SEP)

  // 合計 - 3倍サイズ・太字
  push("[bold: on]")
  push("[magnify: width 3; height 3]")
  push(`合計 ¥${data.totalAmount.toLocaleString()}`)
  push("[magnify]")
  push("[bold: off]")
  push("(税込)")

  push(SEP)
  push("[align: center]")
  push("ご利用ありがとうございました")
  push("[cut]")

  return lines.join("\n")
}
