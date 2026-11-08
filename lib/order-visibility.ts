/**
 * 店舗側に表示する注文の判定。
 *
 * 注文はサーバー（/api/customer/takeout-order, /api/ec/create-order）が「未決済で作成 → 明細作成 →
 * クーポン確定 → カード課金 → ポイント反映」の順に作成し、最後のポイント反映で orders.points_settled_at を設定する。
 * 途中で失敗した注文（カード決済エラー等）は取り消されるため、points_settled_at が未設定の注文は
 * 「作成処理中」または「処理が中断された注文」であり、店舗の一覧・新規注文通知・売上集計の対象外とする
 * （ただし一定時間たっても完了しない注文は、処理が止まったものとして「要確認」で表示する）。
 * （既存の注文は 20261106000300_server_side_points.sql で points_settled_at が設定済み）
 */

/** 作成処理が完了した注文のみに絞り込む（Supabase のクエリに付ける列名） */
export const FINALIZED_ORDER_COLUMN = "points_settled_at"

/**
 * 作成処理がこの時間を過ぎても完了していない注文は、処理が途中で止まった（関数のタイムアウト等）とみなす。
 * 通常の作成処理は数秒で終わり、失敗時は取り消されるため、ここまで残っている注文は課金済みの可能性もある。
 */
const STALLED_ORDER_AFTER_MS = 10 * 60 * 1000

/** 作成処理が途中で止まった注文に付ける備考（店舗の注文一覧・詳細に表示する） */
export const STALLED_ORDER_NOTE = "【要確認】注文の作成処理が途中で止まりました。PAY.JPの管理画面で課金の有無を確認してから対応してください。"

/**
 * 作成処理が途中で止まった注文かどうか（店舗には「要確認」として表示する）。
 * points_settled_at を取得していない行を誤判定しないよう、列が含まれている場合だけ判定する
 */
export function isStalledOrder(row: { points_settled_at?: string | null; needs_attention?: boolean | null }): boolean {
  return "points_settled_at" in row && !row.points_settled_at && !row.needs_attention
}

/**
 * 店舗の注文一覧・売上に含める注文の条件（Supabase の .or() に渡す）。
 *   * 作成完了済みの注文
 *   * 決済結果を確認できず保留した「要確認」の注文（needs_attention）
 *   * 作成処理が途中で止まったまま一定時間たった注文（店舗が課金の有無を確認して対応できるよう表示する）
 */
export function storeVisibleOrderFilter(now: number = Date.now()): string {
  const stalledBefore = new Date(now - STALLED_ORDER_AFTER_MS).toISOString()
  return `points_settled_at.not.is.null,needs_attention.eq.true,created_at.lt.${stalledBefore}`
}

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
