/**
 * ローカルタイムゾーンの日付を YYYY-MM-DD 形式で返す。
 * `Date.toISOString()` はUTCに変換するため、日本時間(UTC+9)では
 * 日付が1日ずれる（例: 7/23 00:00 JST → toISOString()だと7/22扱い）。
 */
export function toLocalDateString(d: Date): string {
  const y = d.getFullYear()
  const m = String(d.getMonth() + 1).padStart(2, "0")
  const day = String(d.getDate()).padStart(2, "0")
  return `${y}-${m}-${day}`
}
