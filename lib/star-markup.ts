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
  lineName?: string | null
  phone?: string | null
  orderDate?: string | null
  paymentStatus?: string | null
  items: ReceiptItem[]
  subtotal: number
  discountAmount?: number | null
  totalAmount: number
}

const SEP = "------------------------"
const MARKUP_COLS = 24

function charW(c: string): number {
  return c.charCodeAt(0) > 0x7f ? 2 : 1
}

function itemLine(name: string, quantity: number): string {
  const suffix = ` x${quantity}`
  const suffixW = suffix.split("").reduce((s, c) => s + charW(c), 0)
  const maxFull  = MARKUP_COLS - suffixW
  const maxTrunc = maxFull - 2

  let nameStr = ""
  let nameW = 0
  let truncate = false

  for (const c of name) {
    const cw = charW(c)
    if (nameW + cw > maxFull) { truncate = true; break }
    nameStr += c
    nameW += cw
  }

  if (!truncate) return nameStr + suffix

  nameStr = ""
  nameW = 0
  for (const c of name) {
    const cw = charW(c)
    if (nameW + cw > maxTrunc) break
    nameStr += c
    nameW += cw
  }
  return nameStr + "…" + suffix
}

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

  // 全体をFont B（小さめ）に設定
  push("[font: name b]")

  push("[align: left]")

  if (data.customerName) push(`名前: ${data.customerName}様`)
  if (data.lineName) push(`LINE: ${data.lineName}`)
  if (data.phone) push(`電話番号: ${data.phone}`)
  if (data.orderDate) push(`注文日時: ${data.orderDate}`)

  const dt = fmtDate(data.pickupDate, data.pickupTime)
  if (dt) push(`受取日時: ${dt}`)

  if (data.paymentStatus) push(`お支払い: ${data.paymentStatus}`)

  push(SEP)

  for (const item of data.items) {
    // 商品名と個数
    push(itemLine(item.name, item.quantity))
    // バリアント（ホールサイズ等）
    if (item.variantName) push(`  ${item.variantName}`)
    // メッセージをサイズの直下に出力
    for (const opt of item.options ?? []) {
      if (!opt.itemName || opt.groupName !== "メッセージ") continue
      push(`  「${opt.itemName}」`)
    }
    // その他オプション（サイズ・メッセージ以外）
    for (const opt of item.options ?? []) {
      if (!opt.itemName) continue
      if (opt.groupName === "サイズ" || opt.groupName === "メッセージ") continue

      let label: string
      if (opt.groupName === "ろうそく") {
        const qty = (opt.quantity ?? 1) > 1 ? ` ×${opt.quantity}` : ""
        label = `${opt.itemName}${qty}`
      } else {
        label = opt.itemName
      }

      push(`  ${label}`)
    }
  }

  push(SEP)
  push(`小計: ¥${data.subtotal.toLocaleString()}`)
  if (data.discountAmount && data.discountAmount > 0) {
    push(`値引き: -¥${data.discountAmount.toLocaleString()}`)
  }
  push(SEP)

  push("[align: center]")
  push("[mag: w 2; h 2]")
  push(`お支払金額`)
  push(`¥${data.totalAmount.toLocaleString()}`)
  push("[mag]")
  push("[align: left]")

  push("[cut]")

  return lines.join("\n")
}
