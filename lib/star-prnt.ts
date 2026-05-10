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
  if (t) parts.push(t)
  return parts.join(" ")
}

// Star Line Mode (StarPRNT) の文字サイズコマンド
// ESC h n: 縦倍率, ESC W n: 横倍率 (n=1〜6)
function size(n: number): Buffer {
  return Buffer.concat([
    cmd(ESC, 0x68, n),
    cmd(ESC, 0x57, n),
  ])
}
const SIZE_1X = size(1)

const SEP = "------------------------"

export function buildStarPRNTReceipt(data: ReceiptData): Buffer {
  const parts: Buffer[] = [
    cmd(ESC, 0x40),        // 初期化
    cmd(ESC, 0x4D, 0x01),  // フォントB (細い・9×24dots、標準のA=12×24dots)
    cmd(ESC, 0x33, 22),    // 行間を 22ドット に設定（デフォルト30）
    SIZE_1X,               // フォントBの標準サイズ（1x）
    blank(),
    // 店名: 太字・中央
    cmd(ESC, 0x61, 0x01),  // センター
    cmd(ESC, 0x45, 0x01),  // 太字ON
    line(data.storeName),
    cmd(ESC, 0x45, 0x00),  // 太字OFF
    line(SEP),
    cmd(ESC, 0x61, 0x00),  // 左揃え
  ]

  if (data.orderNo) parts.push(line(`No: #${data.orderNo}`))

  const dt = fmtDate(data.pickupDate, data.pickupTime)
  if (dt) parts.push(line(`日時: ${dt}`))

  if (data.customerName) parts.push(line(`名前: ${data.customerName}`))

  parts.push(line(SEP))

  for (const item of data.items) {
    parts.push(cmd(ESC, 0x45, 0x01))  // 太字ON
    parts.push(line(item.name))
    parts.push(cmd(ESC, 0x45, 0x00))  // 太字OFF

    if (item.variantName) parts.push(line(`  ${item.variantName}`))

    parts.push(line(`  x${item.quantity}  ¥${item.subtotal.toLocaleString()}`))

    for (const opt of item.options ?? []) {
      if (!opt.itemName) continue
      const qty   = (opt.quantity ?? 0) > 1 ? ` x${opt.quantity}` : ""
      const price = opt.priceDelta && opt.priceDelta !== 0
        ? ` +¥${opt.priceDelta.toLocaleString()}`
        : ""
      parts.push(line(`  ${opt.itemName}${qty}${price}`))
    }

    parts.push(blank())
  }

  parts.push(line(SEP))
  parts.push(line(`小計: ¥${data.subtotal.toLocaleString()}`))
  if (data.discountAmount && data.discountAmount > 0) {
    parts.push(line(`値引: -¥${data.discountAmount.toLocaleString()}`))
  }
  parts.push(line(SEP))

  // 合計: 太字・中央
  parts.push(cmd(ESC, 0x61, 0x01))  // センター
  parts.push(cmd(ESC, 0x45, 0x01))  // 太字ON
  parts.push(line(`¥${data.totalAmount.toLocaleString()}`))
  parts.push(cmd(ESC, 0x45, 0x00))  // 太字OFF
  parts.push(line("(税込)"))
  parts.push(blank())
  parts.push(line("ありがとうございました"))
  parts.push(blank())

  parts.push(cmd(ESC, 0x64, 0x03))       // 3行フィード
  parts.push(cmd(GS,  0x56, 0x41, 0x00)) // フルカット

  return Buffer.concat(parts)
}
