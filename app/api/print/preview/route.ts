















































































































































































































































import { NextRequest, NextResponse } from "next/server"
import { buildReceiptMarkup } from "@/lib/star-markup"

// デバッグ用: マークアップのプレビューを返す
// 例: GET /api/print/preview
export async function GET(_req: NextRequest) {
  const markup = buildReceiptMarkup({
    storeName: "テスト店舗",
    orderNo: "0001",
    pickupDate: new Date().toISOString().split("T")[0],
    pickupTime: "14:00",
    customerName: "テスト太郎",
    items: [
      {
        name: "チョコレートケーキ",
        quantity: 1,
        subtotal: 2500,
        variantName: "4号",
        options: [
          { groupName: "デコレーション", itemName: "イチゴトッピング", priceDelta: 300, quantity: 1 },
        ],
      },
    ],
    subtotal: 2800,
    discountAmount: 0,
    totalAmount: 2800,
  })

  return new NextResponse(markup, {
    headers: { "Content-Type": "text/plain; charset=utf-8" },
  })
}
