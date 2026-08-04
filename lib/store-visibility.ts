/**
 * 開発用の架空店舗（stores.is_dev_only）は本番環境では見えない・注文できないようにする。
 * 「本番」の判定は Next.js のビルド環境（next dev = development / next build = production）で行う。
 */
export function isDevOnlyStoreVisible(isDevOnly: boolean | null | undefined): boolean {
  if (!isDevOnly) return true
  return process.env.NODE_ENV !== "production"
}
