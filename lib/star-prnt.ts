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

function size(n: number): Buffer {
  return Buffer.concat([
    cmd(ESC, 0x68, n),
    cmd(ESC, 0x57, n),
  ])
}
const SIZE_1X = size(1)
const SIZE_2X = size(2)

const SEP = "------------------------"

export function buildStarPRNTReceipt(data: ReceiptData): Buffer {
  const parts: Buffer[] = [
    cmd(ESC, 0x40),        // 初期化
    cmd(ESC, 0x4D, 0x01),  // フォントB
    cmd(ESC, 0x33, 16),    // 行間 16ドット
    SIZE_2X,               // フォントBの2倍サイズ
    blank(),
    // 店名: 太字・中央
    cmd(ESC, 0x61, 0x01),  // センター
    cmd(ESC, 0x45, 0x01),  // 太字ON
    line(data.storeName),
    cmd(ESC, 0x45, 0x00),  // 太字OFF
    line(SEP),
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
    parts.push(line(`${item.name}  x${item.quantity}`))
    parts.push(cmd(ESC, 0x45, 0x00))

    // バリアント（ホールサイズ等）
    if (item.variantName) parts.push(line(item.variantName))

    // オプション（左揃え・箇条点なし）
    for (const opt of item.options ?? []) {
      if (!opt.itemName) continue
      // サイズはvariantNameで表示済みのためスキップ
      if (opt.groupName === "サイズ") continue

      let label: string
      if (opt.groupName === "メッセージ") {
        label = `「${opt.itemName}」`
      } else if (opt.groupName === "ろうそく") {
        // ろうそくは本数を表示
        const qty = (opt.quantity ?? 1) > 1 ? ` ×${opt.quantity}` : ""
        label = `${opt.itemName}${qty}`
      } else {
        // その他はアイテム名のみ
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
