"use client"

import type { UICartItem } from "@/lib/types"

interface PrintReceiptProps {
  customerName: string
  lineName?: string | null
  phone: string
  orderDateTime: Date
  deliveryTime: string
  items: UICartItem[]
  subtotal: number
  shippingFee?: number
  usedPoints: number
  total: number
  storeName: string
}

export function PrintReceipt({
  customerName,
  lineName,
  phone,
  orderDateTime,
  deliveryTime,
  items,
  subtotal,
  shippingFee = 0,
  usedPoints,
  total,
  storeName,
}: PrintReceiptProps) {
  const fmt = (n: number) => `¥${n.toLocaleString()}`
  const fmtDate = (d: Date) =>
    `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`

  const enrichedItems = items.map((item) => {
    const c = item.customization
    const optSum = [
      c?.sizePrice ?? 0,
      ...(c?.candles ?? []).map((cd) => cd.price * cd.quantity),
      ...(c?.options ?? []).map((op) => op.price),
      ...(c?.customOptions ?? []).map((o) => o.additionalPrice || 0),
    ].reduce((s, v) => s + v, 0)
    const lineTotal = (item.price + optSum) * item.quantity
    const optionLines: string[] = []
    if (c?.sizeLabel) optionLines.push(c.sizeLabel)
    ;(c?.candles ?? []).forEach((cd) => {
      if (cd.quantity > 0) optionLines.push(`${cd.name} ×${cd.quantity}`)
    })
    ;(c?.options ?? []).forEach((op) => optionLines.push(op.name))
    ;(c?.customOptions ?? []).forEach((co) => {
      if (co.values.length > 0) optionLines.push(`${co.name}: ${co.values.join("、")}`)
    })
    return { ...item, lineTotal, optionLines }
  })

  return (
    <div id="print-receipt-root">
      <style>{`
        #print-receipt-root { display: none; }
        @media print {
          body * { visibility: hidden !important; }
          #print-receipt-root {
            display: block !important;
            visibility: visible !important;
            position: absolute;
            inset: 0;
          }
          #print-receipt-root * { visibility: visible !important; }
          @page { margin: 12mm; }
        }
      `}</style>
      <div
        style={{
          fontFamily: "'Hiragino Kaku Gothic ProN', 'Meiryo', sans-serif",
          fontSize: 13,
          lineHeight: 1.7,
          color: "#000",
          maxWidth: 480,
          margin: "0 auto",
        }}
      >
        {/* 顧客情報 */}
        <table style={{ width: "100%", borderCollapse: "collapse", marginBottom: 8 }}>
          <tbody>
            <tr>
              <td style={{ paddingRight: 16, color: "#555", whiteSpace: "nowrap", verticalAlign: "top" }}>名前</td>
              <td>{customerName || "（未入力）"}</td>
            </tr>
            {lineName && (
              <tr>
                <td style={{ paddingRight: 16, color: "#555", whiteSpace: "nowrap", verticalAlign: "top" }}>LINE名</td>
                <td>{lineName}</td>
              </tr>
            )}
            <tr>
              <td style={{ paddingRight: 16, color: "#555", whiteSpace: "nowrap", verticalAlign: "top" }}>電話番号</td>
              <td>{phone || "（未入力）"}</td>
            </tr>
            <tr>
              <td style={{ paddingRight: 16, color: "#555", whiteSpace: "nowrap", verticalAlign: "top" }}>注文日時</td>
              <td>{fmtDate(orderDateTime)}</td>
            </tr>
            <tr>
              <td style={{ paddingRight: 16, color: "#555", whiteSpace: "nowrap", verticalAlign: "top" }}>受取日時</td>
              <td>{deliveryTime || "（未指定）"}</td>
            </tr>
          </tbody>
        </table>

        <hr style={{ border: "none", borderTop: "1px solid #aaa", margin: "12px 0" }} />

        {/* 商品一覧 */}
        <div style={{ marginBottom: 8 }}>
          {enrichedItems.map((item, idx) => (
            <div
              key={idx}
              style={{
                display: "flex",
                justifyContent: "space-between",
                alignItems: "flex-start",
                padding: "10px 0",
                borderBottom: idx < enrichedItems.length - 1 ? "1px dotted #ccc" : "none",
              }}
            >
              <div style={{ flex: 1, marginRight: 16 }}>
                <div style={{ fontWeight: "bold", fontSize: 13 }}>{item.name}</div>
                {item.optionLines.map((line, i) => (
                  <div key={i} style={{ fontSize: 11, color: "#555" }}>
                    {line}
                  </div>
                ))}
              </div>
              <div style={{ textAlign: "right", whiteSpace: "nowrap" }}>
                <div style={{ fontSize: 11, color: "#555" }}>×{item.quantity}</div>
                <div style={{ fontWeight: "bold", fontSize: 13 }}>{fmt(item.lineTotal)}</div>
              </div>
            </div>
          ))}
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #aaa", margin: "12px 0" }} />

        {/* 金額欄 */}
        <div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, marginBottom: 4 }}>
            <span style={{ color: "#555" }}>小計</span>
            <span style={{ minWidth: 80, textAlign: "right" }}>{fmt(subtotal)}</span>
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, marginBottom: 4 }}>
            <span style={{ color: "#555" }}>配送料</span>
            <span style={{ minWidth: 80, textAlign: "right" }}>{shippingFee === 0 ? "無料" : fmt(shippingFee)}</span>
          </div>
          {usedPoints > 0 && (
            <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, marginBottom: 4 }}>
              <span style={{ color: "#555" }}>ポイント利用</span>
              <span style={{ minWidth: 80, textAlign: "right" }}>-{fmt(usedPoints)}</span>
            </div>
          )}
          <hr style={{ border: "none", borderTop: "1px solid #999", margin: "8px 0 8px auto", width: 220 }} />
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 24, alignItems: "baseline" }}>
            <span style={{ fontWeight: "bold", fontSize: 14 }}>お支払金額</span>
            <span style={{ minWidth: 80, textAlign: "right", fontSize: 20, fontWeight: "bold" }}>{fmt(total)}</span>
          </div>
        </div>

        <hr style={{ border: "none", borderTop: "1px solid #aaa", margin: "20px 0 12px" }} />

        {/* フッター */}
        <div style={{ textAlign: "center" }}>
          <div style={{ fontWeight: "bold", fontSize: 15, color: "#333", letterSpacing: "0.05em" }}>
            {storeName}
          </div>
          <div style={{ fontSize: 11, color: "#888", marginTop: 2 }}>ご注文ありがとうございました</div>
        </div>
      </div>
    </div>
  )
}
