/**
 * 都道府県・配送地方ブロックのマスタ定数
 * 配送料の地域別計算に使用する
 */

export const REGION_BLOCKS = [
  "北海道",
  "東北",
  "関東",
  "信越",
  "北陸",
  "中部",
  "関西",
  "中国",
  "四国",
  "九州",
  "沖縄",
] as const;

export type RegionBlock = (typeof REGION_BLOCKS)[number];

export const PREFECTURES = [
  "北海道",
  "青森県", "岩手県", "宮城県", "秋田県", "山形県", "福島県",
  "茨城県", "栃木県", "群馬県", "埼玉県", "千葉県", "東京都", "神奈川県",
  "新潟県", "長野県",
  "富山県", "石川県", "福井県",
  "山梨県", "岐阜県", "静岡県", "愛知県", "三重県",
  "滋賀県", "京都府", "大阪府", "兵庫県", "奈良県", "和歌山県",
  "鳥取県", "島根県", "岡山県", "広島県", "山口県",
  "徳島県", "香川県", "愛媛県", "高知県",
  "福岡県", "佐賀県", "長崎県", "熊本県", "大分県", "宮崎県", "鹿児島県",
  "沖縄県",
] as const;

export type Prefecture = (typeof PREFECTURES)[number];

/** 都道府県 → 配送地方ブロック */
export const PREFECTURE_TO_REGION: Record<Prefecture, RegionBlock> = {
  "北海道": "北海道",
  "青森県": "東北", "岩手県": "東北", "宮城県": "東北", "秋田県": "東北", "山形県": "東北", "福島県": "東北",
  "茨城県": "関東", "栃木県": "関東", "群馬県": "関東", "埼玉県": "関東", "千葉県": "関東", "東京都": "関東", "神奈川県": "関東",
  "新潟県": "信越", "長野県": "信越",
  "富山県": "北陸", "石川県": "北陸", "福井県": "北陸",
  "山梨県": "中部", "岐阜県": "中部", "静岡県": "中部", "愛知県": "中部", "三重県": "中部",
  "滋賀県": "関西", "京都府": "関西", "大阪府": "関西", "兵庫県": "関西", "奈良県": "関西", "和歌山県": "関西",
  "鳥取県": "中国", "島根県": "中国", "岡山県": "中国", "広島県": "中国", "山口県": "中国",
  "徳島県": "四国", "香川県": "四国", "愛媛県": "四国", "高知県": "四国",
  "福岡県": "九州", "佐賀県": "九州", "長崎県": "九州", "熊本県": "九州", "大分県": "九州", "宮崎県": "九州", "鹿児島県": "九州",
  "沖縄県": "沖縄",
};

/** 沖縄・離島など特別料金/送料無料除外の対象とするブロック（MVPでは沖縄県のみ判定可能） */
export const SPECIAL_REGIONS: RegionBlock[] = ["沖縄"];

export function regionForPrefecture(prefecture: string): RegionBlock | null {
  return (PREFECTURE_TO_REGION as Record<string, RegionBlock>)[prefecture] ?? null;
}

export function isSpecialRegion(prefecture: string): boolean {
  const region = regionForPrefecture(prefecture);
  return region !== null && SPECIAL_REGIONS.includes(region);
}
