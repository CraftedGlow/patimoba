/**
 * 商品マスタ定数
 * 旧DB テーブル (product_types, candle_options, product_categories) から移行
 * これらのデータはコードで管理する
 */

export interface ProductTypeConst {
  id: string
  productType: string
  typeCode: number
}

export interface CandleOptionConst {
  id: string
  name: string
  price: number
  sortOrder: number
}

export interface ProductCategoryConst {
  id: string
  name: string
  sortOrder: number
}

/** 商品タイプ (旧 product_types テーブル) */
export const PRODUCT_TYPES: ProductTypeConst[] = [
  { id: "1", productType: "生菓子", typeCode: 1 },
  { id: "2", productType: "ホール", typeCode: 2 },
  { id: "3", productType: "焼き菓子", typeCode: 3 },
  { id: "4", productType: "ドリンク", typeCode: 4 },
  { id: "5", productType: "その他", typeCode: 5 },
  { id: "6", productType: "クリスマス限定", typeCode: 6 },
]

/** ろうそくオプション (旧 candle_options テーブル) */
export const CANDLE_OPTIONS: CandleOptionConst[] = [
  { id: "1", name: "ナンバーキャンドル", price: 150, sortOrder: 1 },
  { id: "2", name: "ノーマルキャンドル(大)", price: 0, sortOrder: 2 },
  { id: "3", name: "ノーマルキャンドル(小)", price: 0, sortOrder: 3 },
]

/** 商品カテゴリ (旧 product_categories テーブル) */
export const PRODUCT_CATEGORIES: ProductCategoryConst[] = [
  { id: "1", name: "ショートケーキ", sortOrder: 1 },
  { id: "2", name: "チーズケーキ", sortOrder: 2 },
  { id: "3", name: "抹茶ケーキ", sortOrder: 3 },
  { id: "4", name: "チョコレートケーキ", sortOrder: 4 },
  { id: "5", name: "モンブラン", sortOrder: 5 },
  { id: "6", name: "焼き菓子セット", sortOrder: 6 },
  { id: "7", name: "シュークリーム", sortOrder: 7 },
  { id: "8", name: "ホールケーキ", sortOrder: 8 },
  { id: "9", name: "レモンタルト", sortOrder: 9 },
  { id: "10", name: "マドレーヌ", sortOrder: 10 },
  { id: "11", name: "カスタードプリン", sortOrder: 11 },
  { id: "12", name: "マフィン", sortOrder: 12 },
  { id: "13", name: "クッキーの詰め合わせ", sortOrder: 13 },
  { id: "14", name: "ショコラ", sortOrder: 14 },
  { id: "15", name: "ロールケーキ", sortOrder: 15 },
  { id: "16", name: "Today's Cake", sortOrder: 16 },
  { id: "17", name: "クリスマスケーキ", sortOrder: 17 },
  { id: "18", name: "プリントデコ", sortOrder: 18 },
  { id: "19", name: "期間限定 テスト", sortOrder: 19 },
  { id: "20", name: "期間限定②", sortOrder: 20 },
]

/** product_type_id から productType 名を取得 */
export function getProductTypeName(productTypeId: string | null | undefined): string | undefined {
  if (!productTypeId) return undefined
  const found = PRODUCT_TYPES.find((t) => t.id === productTypeId)
  return found?.productType
}
