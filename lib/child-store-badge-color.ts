// マスター店舗が複数の子店舗の注文を横断表示する画面で、店舗名バッジを
// 店舗ごとに見分けやすい色にするためのマッピング。
const COLOR_BY_KEYWORD: { keyword: string; className: string }[] = [
  { keyword: "新川", className: "bg-blue-100 text-blue-700" },
  { keyword: "わさだ", className: "bg-green-100 text-green-700" },
]

const DEFAULT_COLOR = "bg-blue-100 text-blue-700"

export function getChildStoreBadgeColor(storeName: string | undefined | null): string {
  if (!storeName) return DEFAULT_COLOR
  const match = COLOR_BY_KEYWORD.find((c) => storeName.includes(c.keyword))
  return match?.className ?? DEFAULT_COLOR
}
