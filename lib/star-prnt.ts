import type { ReceiptData } from "./star-markup"
import iconv from "iconv-lite"

const ESC = 0x1b
const GS  = 0x1d

function cmd(...bytes: number[]): Buffer {
  return Buffer.from(bytes)
}

function line(str: string): Buffer {
  return iconv.encode(str + "\n", "Shift_JIS")
}

function blank(): Buffer {
  return iconv.encode("\n", "Shift_JIS")
}

function fmtDate(d?: string | null, t?: string | null): string {
  const parts: string[] = []
  if (d) {
    const dt = new Date(d)
    parts.push(
      `${dt.getFullYear()}/${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}`
    )
  }
  if (t) parts.push(String(t).slice(0, 5))
  return parts.join(" ")
}

function size(h: number, w: number): Buffer {
  return Buffer.concat([
    cmd(ESC, 0x68, h),
    cmd(ESC, 0x57, w),
  ])
}
const SIZE_1X   = size(1, 1)
const SIZE_1_5X = size(2, 1)  // 高さ2倍・幅1倍（≒1.5倍）
const SIZE_2X   = size(2, 2)

const SEP = "------------------------"
const LINE_COLS = 24

function strWidth(s: string): number {
  let w = 0
  for (const c of s) w += c.charCodeAt(0) > 0x7f ? 2 : 1
  return w
}

function itemLine(name: string, quantity: number): string {
  const suffix = `  x${quantity}`
  const suffixW = strWidth(suffix)
  const nameMax = LINE_COLS - suffixW
  let nameStr = ""
  let nameW = 0
  for (const c of name) {
    const cw = c.charCodeAt(0) > 0x7f ? 2 : 1
    if (nameW + cw > nameMax) { nameStr += "…"; break }
    nameStr += c
    nameW += cw
  }
  return nameStr + suffix
}

export function buildStarPRNTReceipt(data: ReceiptData): Buffer {
  const parts: Buffer[] = [
    cmd(ESC, 0x40),        // 初期化
    cmd(ESC, 0x4D, 0x01),  // フォントB
    cmd(ESC, 0x33, 16),    // 行間 16ドット
    SIZE_1X,
    cmd(ESC, 0x61, 0x00),  // 左揃え
  ]

  // 顧客情報（モーダルと同じ順序）
  if (data.customerName) parts.push(line(`名前: ${data.customerName}様`))
  if (data.lineName)     parts.push(line(`LINE: ${data.lineName}`))
  if (data.phone)        parts.push(line(`電話番号: ${data.phone}`))
  if (data.orderDate)    parts.push(line(`注文日時: ${data.orderDate}`))

  // 受取日時: 太字で目立たせる
  const dt = fmtDate(data.pickupDate, data.pickupTime)
  if (dt) {
    parts.push(cmd(ESC, 0x45, 0x01))
    parts.push(line(`受取日時: ${dt}`))
    parts.push(cmd(ESC, 0x45, 0x00))
  }

  if (data.paymentStatus) parts.push(line(`お支払い: ${data.paymentStatus}`))

  parts.push(line(SEP))

  for (const item of data.items) {
    // 商品名と個数を同じ行に（太字）
    parts.push(cmd(ESC, 0x45, 0x01))
    parts.push(line(itemLine(item.name, item.quantity)))
    parts.push(cmd(ESC, 0x45, 0x00))

    // バリアント（ホールサイズ等）
    if (item.variantName) parts.push(line(item.variantName))

    // メッセージをサイズの直下に出力
    for (const opt of item.options ?? []) {
      if (!opt.itemName || opt.groupName !== "メッセージ") continue
      parts.push(line(`「${opt.itemName}」`))
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

      parts.push(line(label))
    }

    parts.push(blank())
  }

  parts.push(line(SEP))
  parts.push(line(`小計: ¥${data.subtotal.toLocaleString()}`))
  if (data.discountAmount && data.discountAmount > 0) {
    parts.push(line(`値引き: -¥${data.discountAmount.toLocaleString()}`))
  }
  parts.push(line(SEP))

  // お支払金額: 中央・2倍サイズ・太字
  parts.push(cmd(ESC, 0x61, 0x01))
  parts.push(line("お支払金額"))
  parts.push(cmd(ESC, 0x45, 0x01))
  parts.push(SIZE_2X)
  parts.push(line(`¥${data.totalAmount.toLocaleString()}`))
  parts.push(SIZE_1X)
  parts.push(cmd(ESC, 0x45, 0x00))
  parts.push(blank())

  parts.push(cmd(ESC, 0x64, 0x03))        // 3行フィード
  parts.push(cmd(GS,  0x56, 0x41, 0x00))  // フルカット

  return Buffer.concat(parts)
}
