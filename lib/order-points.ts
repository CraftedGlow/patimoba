// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

/**
 * 注文のポイント（利用分の減算 + 付与分の加算）をサーバー側で1回だけ反映する。
 * DB関数 settle_order_points（supabase/migrations/20261106000300_server_side_points.sql）を使う。
 * 既に反映済みの注文に対しては何もしない。
 */
export async function settleOrderPoints(
  supabaseAdmin: AdminClient,
  orderId: string,
  earnedPoints: number
): Promise<{ ok: true } | { ok: false; reason: "insufficient_points" | "error" }> {
  const { error } = await supabaseAdmin.rpc("settle_order_points", {
    p_order_id: orderId,
    p_earned: Math.max(0, Math.floor(earnedPoints)),
  });
  if (!error) return { ok: true };
  if (String(error.message ?? "").includes("insufficient_points")) {
    return { ok: false, reason: "insufficient_points" };
  }
  console.error("[order-points] settle error:", error);
  return { ok: false, reason: "error" };
}

/**
 * 反映済みの注文ポイントを取り消す（利用分を返還し、付与分を回収する）。
 * キャンセル時・作成途中の注文の取り消し時に使う。未反映の注文には何もしない。
 */
export async function revertOrderPoints(supabaseAdmin: AdminClient, orderId: string): Promise<boolean> {
  const { error } = await supabaseAdmin.rpc("revert_order_points", { p_order_id: orderId });
  if (error) {
    console.error("[order-points] revert error:", error, { orderId });
    return false;
  }
  return true;
}
