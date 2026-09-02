import type { ReceiptData } from "./star-markup"
import iconv from "iconv-lite"

const ESC = 0x1b
const GS  = 0x1d

function cmd(...bytes: number[]): Buffer {
  return Buffer.from(bytes)
}

// SNS等の「装飾フォント」で入力されたテキスト（Unicode数学英数字記号・全角英数字など）を
// 通常の半角英数字に正規化する。Shift_JISにもプリンターのフォントにも存在しないため、
// 正規化しないと iconv がすべて "?" に置き換えてしまう。
const FANCY_LETTER_STYLE_STARTS = [
  0x1d400, // Bold
  0x1d434, // Italic
  0x1d468, // Bold Italic
  0x1d49c, // Script
  0x1d4d0, // Bold Script
  0x1d504, // Fraktur
  0x1d538, // Double-struck
  0x1d56c, // Bold Fraktur
  0x1d5a0, // Sans-serif
  0x1d5d4, // Sans-serif Bold
  0x1d608, // Sans-serif Italic
  0x1d63c, // Sans-serif Bold Italic
  0x1d670, // Monospace
]
const FANCY_DIGIT_STYLE_STARTS = [
  0x1d7ce, // Bold
  0x1d7d8, // Double-struck
  0x1d7e2, // Sans-serif
  0x1d7ec, // Sans-serif Bold
  0x1d7f6, // Monospace
]

function normalizeFancyUnicode(str: string): string {
  let result = ""
  for (const ch of str) {
    const code = ch.codePointAt(0) ?? 0

    if (code >= 0xff21 && code <= 0xff3a) { result += String.fromCharCode(0x41 + (code - 0xff21)); continue } // 全角A-Z
    if (code >= 0xff41 && code <= 0xff5a) { result += String.fromCharCode(0x61 + (code - 0xff41)); continue } // 全角a-z
    if (code >= 0xff10 && code <= 0xff19) { result += String.fromCharCode(0x30 + (code - 0xff10)); continue } // 全角0-9

    const letterStart = FANCY_LETTER_STYLE_STARTS.find((s) => code >= s && code <= s + 51)
    if (letterStart !== undefined) {
      const offset = code - letterStart
      result += offset < 26 ? String.fromCharCode(0x41 + offset) : String.fromCharCode(0x61 + (offset - 26))
      continue
    }

    const digitStart = FANCY_DIGIT_STYLE_STARTS.find((s) => code >= s && code <= s + 9)
    if (digitStart !== undefined) {
      result += String.fromCharCode(0x30 + (code - digitStart))
      continue
    }

    result += ch
  }
  return result
}

function line(str: string): Buffer {
  return iconv.encode(normalizeFancyUnicode(str) + "\n", "Shift_JIS")
}

function blank(): Buffer {
  return iconv.encode("\n", "Shift_JIS")
}

function fmtDate(d?: string | null, t?: string | null): string {
  const parts: string[] = []
  if (d) {
    const dt = new Date(d)
    parts.push(
      `${String(dt.getMonth() + 1).padStart(2, "0")}/${String(dt.getDate()).padStart(2, "0")}`
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
const LINE_COLS = 22

function charW(c: string): number {
  return c.charCodeAt(0) > 0x7f ? 2 : 1
}

const QTY_COLS = 6 // 個数欄の幅（右端固定）

function itemLine(name: string, quantity: number): string {
  const qty = `x${quantity}`
  const qtyW = qty.split("").reduce((s, c) => s + charW(c), 0)
  const nameFirstMax = LINE_COLS - QTY_COLS

  const lines: string[] = []
  let cur = ""
  let curW = 0
  let isFirst = true

  for (const c of name) {
    const cw = charW(c)
    const maxW = isFirst ? nameFirstMax : LINE_COLS
    if (curW + cw > maxW) {
      lines.push(cur)
      cur = ""
      curW = 0
      isFirst = false
    }
    cur += c
    curW += cw
  }
  lines.push(cur)

  const firstW = lines[0].split("").reduce((s, c) => s + charW(c), 0)
  const pad = " ".repeat(Math.max(1, LINE_COLS - firstW - qtyW))
  lines[0] = lines[0] + pad + qty

  return lines.join("\n")
}

export function buildStarPRNTReceipt(data: ReceiptData): Buffer {
  const parts: Buffer[] = [
    cmd(ESC, 0x40),        // 初期化
    cmd(ESC, 0x4D, 0x01),  // フォントB
    cmd(ESC, 0x33, 10),    // 行間 10ドット
    SIZE_1X,
    cmd(ESC, 0x61, 0x00),  // 左揃え
  ]

  // 顧客情報（モーダルと同じ順序）
  if (data.customerName) parts.push(line(`名前: ${data.customerName}様`))
  if (data.lineName)     parts.push(line(`LINE: ${data.lineName}`))
  if (data.phone)        parts.push(line(`電話番号: ${data.phone}`))
  if (data.orderDate)    parts.push(line(`注文日時: ${data.orderDate}`))

  const dt = fmtDate(data.pickupDate, data.pickupTime)
  if (dt) parts.push(line(`受取日時: ${dt}`))

  if (data.paymentStatus) parts.push(line(`お支払い: ${data.paymentStatus}`))

  parts.push(line(SEP))

  for (const item of data.items) {
    parts.push(line(itemLine(item.name, item.quantity)))

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

  }

  parts.push(line(SEP))
  parts.push(line(`小計: ¥${data.subtotal.toLocaleString()}`))
  if (data.discountAmount && data.discountAmount > 0) {
    parts.push(line(`値引き: -¥${data.discountAmount.toLocaleString()}`))
  }
  parts.push(line(SEP))

  const amountStr = `¥${data.totalAmount.toLocaleString()}`
  const amountW = amountStr.split("").reduce((s, c) => s + charW(c), 0)
  const labelStr = "お支払金額"
  const labelW = labelStr.split("").reduce((s, c) => s + charW(c), 0)
  const amountPad = " ".repeat(Math.max(1, LINE_COLS - labelW - amountW))
  parts.push(line(`${labelStr}${amountPad}${amountStr}`))

  parts.push(cmd(ESC, 0x64, 0x02))  // 2行フィード
  parts.push(cmd(ESC, 0x69))        // フルカット (Star専用)

  return Buffer.concat(parts)
}
