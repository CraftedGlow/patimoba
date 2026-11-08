/**
 * 店舗側に表示する注文の判定。
 *
 * 注文はサーバー（/api/customer/takeout-order, /api/ec/create-order）が「未決済で作成 → 明細作成 →
 * クーポン確定 → カード課金 → ポイント反映」の順に作成し、最後のポイント反映で orders.points_settled_at を設定する。
 * 途中で失敗した注文（カード決済エラー等）は取り消されるため、points_settled_at が未設定の注文は
 * 「作成処理中」または「処理が中断された注文」であり、店舗の一覧・新規注文通知・売上集計の対象外とする。
 * （既存の注文は 20261106000300_server_side_points.sql で points_settled_at が設定済み）
 */

/** 作成処理が完了した注文のみに絞り込む（Supabase のクエリに付ける列名） */
export const FINALIZED_ORDER_COLUMN = "points_settled_at"

/**
 * 店舗の注文一覧に表示する注文の条件（Supabase の .or() に渡す）。
 * 作成完了済みの注文に加え、決済結果を確認できず保留した「要確認」の注文（needs_attention）も表示する
 */
export const STORE_VISIBLE_ORDER_FILTER = "points_settled_at.not.is.null,needs_attention.eq.true"

/** 新規注文として扱う期間（作成完了からこの時間内の更新イベントだけを「新しい注文が入った」とみなす） */
const NEW_ORDER_WINDOW_MS = 10 * 60 * 1000

/**
 * Realtime の orders UPDATE イベントの new 行が「作成処理が完了したばかりの新規注文」かどうか。
 * 作成完了時（points_settled_at の設定）は UPDATE イベントになるため、INSERT ではなくこちらで新規注文を検知する。
 * 店舗が対応した（受付中でなくなった）注文や、しばらく前に完了した注文の更新は対象外。
 */
export function isNewlyFinalizedOrder(row: { points_settled_at?: string | null; order_status?: string | null } | null | undefined): boolean {
  if (!row?.points_settled_at) return false
  if (row.order_status && row.order_status !== "pending") return false
  const settledAt = Date.parse(row.points_settled_at)
  return Number.isFinite(settledAt) && Date.now() - settledAt < NEW_ORDER_WINDOW_MS
}
