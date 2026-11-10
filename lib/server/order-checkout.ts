// サーバー（service_role）専用: 注文作成API（/api/customer/takeout-order, /api/ec/create-order）の共通処理
import { calculateShippingFee, shippingSettingsFromRow, DEFAULT_SHIPPING_SETTINGS, FALLBACK_FLAT_FEE, type RegionRate } from "@/lib/shipping-fee";
import { regionForPrefecture } from "@/lib/constants/regions";
import { releaseCouponReservation, releaseCouponForCancelledOrder, finalizeCouponDelivery } from "@/lib/coupons";
import { calcItemSubtotal } from "@/lib/cart-pricing";
import { allocateCandleFreeQuantity } from "@/lib/candle-pricing";
import { payjpChargeCustomer, payjpRefund } from "@/lib/payjp";
import { settleOrderPoints, revertOrderPoints } from "@/lib/order-points";
import type { PricedCartItem, PricedBag } from "@/lib/server/cart-pricing";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

// ───────────────────────── 送料 ─────────────────────────

const SHIPPING_SETTINGS_COLUMNS = "mode, flat_fee, origin_region, free_shipping_enabled, free_shipping_threshold, free_shipping_excludes_special_regions, remote_surcharge";

async function resolveOriginRegionForStore(supabaseAdmin: AdminClient, storeId: string): Promise<string | null> {
  const { data: store } = await supabaseAdmin.from("stores").select("postal_code").eq("id", storeId).maybeSingle();
  const digits = (store?.postal_code ?? "").replace(/[^0-9]/g, "");
  if (digits.length !== 7) return null;
  try {
    const res = await fetch(`https://zipcloud.ibsnet.co.jp/api/search?zipcode=${digits}`, { cache: "no-store" });
    const data = await res.json();
    const prefecture = data?.results?.[0]?.address1 as string | undefined;
    return prefecture ? regionForPrefecture(prefecture) : null;
  } catch {
    return null;
  }
}

// 配送設定が未保存の店舗が無言で送料0円にならないよう、初回利用時に妥当な既定値(地域別料金＋自動判定した発地、
// 判定不能なら一律料金のフォールバック額)を実際に保存しておく。以後は店舗が /store/shipping からいつでも変更できる。
async function ensureShippingSettings(supabaseAdmin: AdminClient, storeId: string) {
  const originRegion = await resolveOriginRegionForStore(supabaseAdmin, storeId);
  const payload = {
    store_id: storeId,
    mode: originRegion ? "region" : "flat",
    flat_fee: FALLBACK_FLAT_FEE,
    origin_region: originRegion,
    free_shipping_enabled: false,
    free_shipping_threshold: null,
    free_shipping_excludes_special_regions: true,
    remote_surcharge: 0,
  };
  const { data } = await supabaseAdmin
    .from("store_shipping_settings")
    .insert(payload)
    .select(SHIPPING_SETTINGS_COLUMNS)
    .maybeSingle();
  if (data) return data;

  // 競合(同時に別の注文が先に既定値を保存した)の場合はその行を読み直す
  const { data: existing } = await supabaseAdmin
    .from("store_shipping_settings")
    .select(SHIPPING_SETTINGS_COLUMNS)
    .eq("store_id", storeId)
    .maybeSingle();
  return existing;
}

/**
 * EC注文の送料を店舗設定からサーバー側で計算する。
 * 注文作成（/api/ec/create-order）と会計画面の表示（/api/ec/shipping-fee）の両方がこの関数を使うため、
 * 画面に表示した送料と確定時の送料が食い違うことはない。subtotal はサーバーで再計算した商品小計を渡すこと。
 */
export async function resolveShippingFee(
  supabaseAdmin: AdminClient,
  orderStoreId: string,
  prefecture: string | undefined,
  subtotal: number
): Promise<number> {
  if (!prefecture) return 0;

  // 配送設定は店舗グループ内で共有されているため、子店舗の注文は本部（マスター）の設定を使う
  const { data: orderStore } = await supabaseAdmin
    .from("stores")
    .select("parent_store_id")
    .eq("id", orderStoreId)
    .maybeSingle();
  const storeId = orderStore?.parent_store_id ?? orderStoreId;

  let settingsRow = (await supabaseAdmin
    .from("store_shipping_settings")
    .select(SHIPPING_SETTINGS_COLUMNS)
    .eq("store_id", storeId)
    .maybeSingle()).data;

  if (!settingsRow) settingsRow = await ensureShippingSettings(supabaseAdmin, storeId);

  const settings = settingsRow ? shippingSettingsFromRow(settingsRow) : DEFAULT_SHIPPING_SETTINGS;

  let rates: RegionRate[] = [];
  if (settings.mode === "region") {
    const destinationRegion = regionForPrefecture(prefecture);
    if (destinationRegion) {
      const { data: overrideRow } = await supabaseAdmin
        .from("store_shipping_rate_overrides")
        .select("fee")
        .eq("store_id", storeId)
        .eq("destination_region", destinationRegion)
        .maybeSingle();
      if (overrideRow) {
        rates = [{ destinationRegion, fee: overrideRow.fee }];
      } else if (settings.originRegion) {
        const { data: masterRow } = await supabaseAdmin
          .from("shipping_rate_regions")
          .select("fee")
          .eq("origin_region", settings.originRegion)
          .eq("destination_region", destinationRegion)
          .maybeSingle();
        if (masterRow) rates = [{ destinationRegion, fee: masterRow.fee }];
      }
    }
  }

  return calculateShippingFee({ settings, rates, destinationPrefecture: prefecture, subtotal });
}

// ───────────────────────── 冪等化（client_request_id） ─────────────────────────

const UUID_RE = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

export function isValidClientRequestId(value: unknown): value is string {
  return typeof value === "string" && UUID_RE.test(value);
}

export type ExistingOrderOutcome =
  | { kind: "none" }
  | { kind: "completed"; orderId: string; totalAmount: number }
  | { kind: "conflict"; status: 409; error: string; code: string };

/**
 * 同じ client_request_id の注文が既にあるか確認する（通信エラー後の再送で二重に注文・課金しないため）。
 * - 作成完了済み（ポイント反映済み）で同じお客様の注文 → その注文の結果を返す
 * - 作成処理中 → 409（再送側では何もしない。クーポン予約も解放しない）
 */
export async function findOrderByClientRequestId(
  supabaseAdmin: AdminClient,
  clientRequestId: string | null,
  customerId: string
): Promise<ExistingOrderOutcome> {
  if (!clientRequestId) return { kind: "none" };
  const { data: existing } = await supabaseAdmin
    .from("orders")
    .select("id, customer_id, total_amount, points_settled_at, needs_attention")
    .eq("client_request_id", clientRequestId)
    .maybeSingle();
  if (!existing) return { kind: "none" };
  if (existing.customer_id !== customerId) {
    return { kind: "conflict", status: 409, error: "注文を作成できませんでした。お手数ですがページを再読み込みしてください。", code: "request_id_conflict" };
  }
  if (existing.points_settled_at) {
    return { kind: "completed", orderId: existing.id, totalAmount: Number(existing.total_amount) || 0 };
  }
  if (existing.needs_attention) {
    return { kind: "conflict", status: 409, error: NEEDS_ATTENTION_ERROR, code: "order_in_progress" };
  }
  return {
    kind: "conflict",
    status: 409,
    error: "ご注文を処理しています。しばらくしてから注文履歴をご確認ください。",
    code: "order_in_progress",
  };
}

/** insert が client_request_id の一意制約に当たったかどうか */
export function isClientRequestIdConflict(error: { code?: string; message?: string } | null | undefined): boolean {
  return !!error && error.code === "23505" && String(error.message ?? "").includes("client_request_id");
}

/**
 * 明細作成に失敗したときにお客様へ返すエラー。
 * 商品の累計予約数上限のトリガー（enforce_product_max_total_quantity）は errcode P0001 で
 * お客様向けの文言を返すため、その場合はそのまま伝える
 */
export function orderLinesFailure(error: unknown): { error: string; status: number } {
  const e = error as { code?: string; message?: string } | null | undefined;
  if (e?.code === "P0001" && e.message) return { error: e.message, status: 409 };
  return { error: "注文の作成に失敗しました", status: 500 };
}

// ───────────────────────── 明細・オプションの作成 ─────────────────────────

/**
 * 金額確定済みのカート内容から order_items / order_item_options を作成する。
 * レシート印字用の短縮名（商品・デコレーション・カスタムオプション）は注文作成時点の値をスナップショットする。
 */
export async function insertOrderLines(
  supabaseAdmin: AdminClient,
  orderId: string,
  items: PricedCartItem[],
  bag: PricedBag | null
): Promise<{ ok: boolean; error?: unknown }> {
  const orderItems: Record<string, unknown>[] = items.map((item) => ({
    order_id: orderId,
    product_id: item.productId,
    product_name_snapshot: item.name,
    product_short_name_snapshot: item.shortName,
    quantity: item.quantity,
    unit_price: item.price,
    subtotal: calcItemSubtotal(item),
    variant_name_snapshot: item.customization?.sizeLabel ?? null,
  }));

  // 袋は特定商品に紐づく行ではなく注文全体への追加なので、product_id なしの行として追加する
  if (bag) {
    orderItems.push({
      order_id: orderId,
      product_id: null,
      product_name_snapshot: `袋: ${bag.name}`,
      product_short_name_snapshot: null,
      quantity: bag.quantity,
      unit_price: bag.unitPrice,
      subtotal: bag.unitPrice * bag.quantity,
      variant_name_snapshot: null,
    });
  }

  const { data: insertedItems, error: itemsErr } = await supabaseAdmin
    .from("order_items")
    .insert(orderItems)
    .select("id");
  if (itemsErr || !insertedItems || insertedItems.length !== orderItems.length) {
    return { ok: false, error: itemsErr };
  }

  const options: Record<string, unknown>[] = [];
  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    const orderItemId = insertedItems[i].id;
    const c = item.customization;
    if (!c) continue;

    if (c.sizeId) {
      options.push({
        order_item_id: orderItemId,
        option_group_name_snapshot: "サイズ",
        option_item_name_snapshot: c.sizeLabel ?? "",
        price_delta: c.sizePrice ?? 0,
      });
    }
    for (const cd of allocateCandleFreeQuantity(c.candles || [])) {
      if (!cd.candleOptionId || cd.quantity <= 0) continue;
      options.push({
        order_item_id: orderItemId,
        option_group_name_snapshot: "ろうそく",
        option_item_name_snapshot: cd.name,
        price_delta: cd.price,
        quantity: cd.quantity,
        free_quantity: cd.usedFree,
      });
    }
    for (const op of c.options || []) {
      options.push({
        order_item_id: orderItemId,
        option_group_name_snapshot: op.groupName,
        option_item_name_snapshot: op.name,
        option_item_short_name_snapshot: op.shortName,
        decoration_id: op.decorationId,
        price_delta: op.price,
      });
      if (op.message) {
        options.push({
          order_item_id: orderItemId,
          option_group_name_snapshot: "プレートメッセージ",
          option_item_name_snapshot: `${op.name}「${op.message}」`,
          price_delta: 0,
        });
      }
    }
    if (c.messagePlateOption) {
      options.push({
        order_item_id: orderItemId,
        option_group_name_snapshot: "メッセージプレート",
        option_item_name_snapshot: c.messagePlateOption.name,
        price_delta: c.messagePlateOption.price || 0,
      });
    }
    if (c.messagePlate) {
      options.push({
        order_item_id: orderItemId,
        option_group_name_snapshot: "メッセージ",
        option_item_name_snapshot: c.messagePlate,
        price_delta: 0,
      });
    }
    if (c.allergyNote) {
      options.push({
        order_item_id: orderItemId,
        option_group_name_snapshot: "アレルギー",
        option_item_name_snapshot: c.allergyNote,
        price_delta: 0,
      });
    }
    for (const co of c.customOptions || []) {
      if (!co.values?.length) continue;
      options.push({
        order_item_id: orderItemId,
        option_group_name_snapshot: co.name,
        option_item_name_snapshot: co.values.join("、"),
        option_item_short_name_snapshot: co.shortName,
        product_id: item.productId,
        price_delta: co.additionalPrice || 0,
      });
    }
    // のし（customer/orders 詳細ページが同じ option_group_name_snapshot を参照する）
    if (c.noshi) {
      options.push({
        order_item_id: orderItemId,
        option_group_name_snapshot: "のし",
        option_item_name_snapshot: c.noshi.name,
        price_delta: c.noshi.price || 0,
      });
      if (c.noshi.purpose) {
        options.push({
          order_item_id: orderItemId,
          option_group_name_snapshot: "のし用途",
          option_item_name_snapshot: c.noshi.purpose,
          price_delta: 0,
        });
      }
      if (c.noshi.displayName) {
        options.push({
          order_item_id: orderItemId,
          option_group_name_snapshot: "のし名前",
          option_item_name_snapshot: c.noshi.displayName,
          price_delta: 0,
        });
      }
    }
  }

  if (options.length > 0) {
    const { error: optErr } = await supabaseAdmin.from("order_item_options").insert(options);
    if (optErr) return { ok: false, error: optErr };
  }
  return { ok: true };
}

// ───────────────────────── 取り消し・確定 ─────────────────────────

/** 作成途中の注文（明細・オプション・クーポン紐付け・ポイント反映含む）を取り消す */
export async function rollbackOrder(supabaseAdmin: AdminClient, orderId: string, couponDeliveryId: string | null | undefined) {
  await revertOrderPoints(supabaseAdmin, orderId);
  await releaseCouponForCancelledOrder(orderId, supabaseAdmin);
  const { data: rows } = await supabaseAdmin.from("order_items").select("id").eq("order_id", orderId);
  const itemIds = (rows ?? []).map((r: { id: string }) => r.id);
  if (itemIds.length > 0) await supabaseAdmin.from("order_item_options").delete().in("order_item_id", itemIds);
  await supabaseAdmin.from("order_items").delete().eq("order_id", orderId);
  await supabaseAdmin.from("orders").delete().eq("id", orderId);
  if (couponDeliveryId) await releaseCouponReservation(couponDeliveryId, supabaseAdmin);
}

export type CompleteOrderResult =
  | { ok: true; totalAmount: number }
  /** code: "order_in_progress" のとき画面は同じ試行IDを保持し、新しい注文を作らない */
  | { ok: false; status: number; error: string; code?: string };

const NEEDS_ATTENTION_ERROR = "決済の確認が必要なため、ご注文を保留しています。お手数ですが店舗までご連絡ください。";

/**
 * 課金されたかどうか確定できない・返金できなかった注文を、取り消さずに「要確認」として残す。
 * 店舗の注文一覧に表示され（needs_attention）、備考の先頭に要確認の旨を付ける。
 */
async function markNeedsAttention(
  supabaseAdmin: AdminClient,
  orderId: string,
  chargeId: string | null,
  reason: string,
  logTag: string
): Promise<CompleteOrderResult> {
  console.error(`[${logTag}] 要確認の注文として保留:`, { orderId, chargeId, reason });
  try {
    const { data: row } = await supabaseAdmin.from("orders").select("notes").eq("id", orderId).maybeSingle();
    const note = `【要確認】${reason}（注文ID: ${orderId}${chargeId ? ` / 課金ID: ${chargeId}` : ""}）`;
    const update: Record<string, unknown> = {
      needs_attention: true,
      notes: row?.notes ? `${note}\n${row.notes}` : note,
    };
    if (chargeId) update.payjp_charge_id = chargeId;
    const { error } = await supabaseAdmin.from("orders").update(update).eq("id", orderId);
    if (error) console.error(`[${logTag}] 要確認フラグ更新エラー:`, error, { orderId, chargeId });
  } catch (e) {
    console.error(`[${logTag}] 要確認フラグ更新例外:`, e, { orderId, chargeId });
  }
  return { ok: false, status: 502, error: NEEDS_ATTENTION_ERROR, code: "order_in_progress" };
}

/**
 * 明細まで作成済みの未決済注文を確定する。失敗した場合は注文を取り消す（課金済みなら返金する）。
 *   1. クーポン割引をDB上の注文小計から再計算して反映
 *   2. 画面に表示していた合計（expectedTotal）と一致しなければ中止（課金しない）
 *   3. カード払いなら確定した合計で注文者本人の登録カードに課金し、決済済みにする
 *   4. 最後にポイント（利用分の減算・付与分の加算）を反映する
 * orders.points_settled_at は最後の手順でのみ設定されるため、「作成処理が完了した注文」の目印になる
 * （店舗側の注文一覧・新規注文通知は points_settled_at が設定された注文だけを扱う）。
 */
export async function completeOrder(
  supabaseAdmin: AdminClient,
  params: {
    orderId: string;
    initialTotal: number;
    couponDeliveryId: string | null;
    expectedTotal: number;
    /** 確定合計から付与ポイントを求める（EC と テイクアウトで計算式が異なる） */
    earnedPoints: (totalAmount: number) => number;
    /** カード払いの場合の課金先。null なら課金しない（店頭払い） */
    charge: { payjpCustomerId: string; tenantId: string } | null;
    logTag: string;
  }
): Promise<CompleteOrderResult> {
  const { orderId, couponDeliveryId, logTag } = params;
  // 課金の状態: 未課金 / 課金済み（chargeId あり）/ 結果不明。例外時の後始末の判断に使う
  const state: { chargeId: string | null; chargeUnknown: boolean } = { chargeId: null, chargeUnknown: false };
  try {
    return await completeOrderSteps(supabaseAdmin, params, state);
  } catch (e) {
    console.error(`[${logTag}] 確定処理中の例外:`, e, { orderId });
    if (state.chargeId || state.chargeUnknown) {
      // 課金済み・課金不明のまま取り消すと「課金だけ残る」可能性があるため、要確認として残す
      return markNeedsAttention(supabaseAdmin, orderId, state.chargeId, "決済後の処理でエラーが発生しました", logTag);
    }
    try {
      await rollbackOrder(supabaseAdmin, orderId, couponDeliveryId);
    } catch (rollbackErr) {
      console.error(`[${logTag}] 取り消し処理の例外:`, rollbackErr, { orderId });
    }
    return { ok: false, status: 500, error: "注文処理中にエラーが発生しました" };
  }
}

async function completeOrderSteps(
  supabaseAdmin: AdminClient,
  params: Parameters<typeof completeOrder>[1],
  state: { chargeId: string | null; chargeUnknown: boolean }
): Promise<CompleteOrderResult> {
  const { orderId, couponDeliveryId, logTag } = params;
  const abort = async (error: string, status: number): Promise<CompleteOrderResult> => {
    await rollbackOrder(supabaseAdmin, orderId, couponDeliveryId);
    return { ok: false, status, error };
  };

  let totalAmount = params.initialTotal;
  if (couponDeliveryId) {
    const finalized = await finalizeCouponDelivery(couponDeliveryId, orderId, supabaseAdmin);
    if (!finalized.ok) {
      return abort("クーポンをご利用いただけませんでした。お手数ですが再度お試しください。", 400);
    }
    totalAmount = finalized.totalAmount;
  }

  // 画面に表示していた金額と異なる場合は確定しない（価格改定・不正な申告値など）
  if (totalAmount !== params.expectedTotal) {
    return abort("ご注文金額が変更されました。お手数ですがカートの内容をご確認のうえ、再度お試しください。", 409);
  }

  let chargeId: string | null = null;
  if (params.charge) {
    state.chargeUnknown = true;
    const charge = await payjpChargeCustomer({
      customerId: params.charge.payjpCustomerId,
      tenantId: params.charge.tenantId,
      amount: totalAmount,
      idempotencyKey: `order-charge-${orderId}`,
    });
    if (!charge.ok) {
      if (charge.outcomeUnknown) {
        return markNeedsAttention(supabaseAdmin, orderId, null, "カード決済の結果を確認できませんでした", logTag);
      }
      state.chargeUnknown = false;
      return abort(charge.message, charge.status >= 500 ? 502 : 400);
    }
    chargeId = charge.chargeId;
    state.chargeId = chargeId;
    state.chargeUnknown = false;

    const { data: paidOrder, error: paidErr } = await supabaseAdmin
      .from("orders")
      .update({ payment_status: "paid", payment_method: "credit", payjp_charge_id: chargeId })
      .eq("id", orderId)
      .eq("payment_status", "unpaid")
      .is("payjp_charge_id", null)
      .select("id")
      .maybeSingle();
    if (paidErr || !paidOrder) {
      console.error(`[${logTag}] 決済済み更新エラー:`, paidErr);
      if (await refundAndRollback(supabaseAdmin, orderId, couponDeliveryId, chargeId, logTag)) {
        return { ok: false, status: 500, error: "注文処理中にエラーが発生しました。お手数ですが再度お試しください。" };
      }
      return markNeedsAttention(supabaseAdmin, orderId, chargeId, "決済済みへの更新と返金に失敗しました", logTag);
    }
  }

  // ポイントの反映は最後に1回だけ行う（反映済みなら何もしない）
  const pointsResult = await settleOrderPoints(supabaseAdmin, orderId, params.earnedPoints(totalAmount));
  if (!pointsResult.ok) {
    const insufficient = pointsResult.reason === "insufficient_points";
    const error = insufficient ? "ご利用ポイントが不足しています。お手数ですが再度お試しください。" : "注文の作成に失敗しました";
    const status = insufficient ? 409 : 500;
    if (!chargeId) return abort(error, status);
    if (await refundAndRollback(supabaseAdmin, orderId, couponDeliveryId, chargeId, logTag)) {
      return { ok: false, status, error };
    }
    return markNeedsAttention(supabaseAdmin, orderId, chargeId, "ポイント反映と返金に失敗しました", logTag);
  }

  return { ok: true, totalAmount };
}

/** 課金だけが残らないよう返金してから注文を取り消す。返金できなければ手動対応用に注文を残す（false を返す） */
async function refundAndRollback(
  supabaseAdmin: AdminClient,
  orderId: string,
  couponDeliveryId: string | null,
  chargeId: string,
  logTag: string
): Promise<boolean> {
  if (await payjpRefund(chargeId)) {
    await rollbackOrder(supabaseAdmin, orderId, couponDeliveryId);
    return true;
  }
  console.error(`[${logTag}] 返金失敗（要手動対応）:`, { orderId, chargeId });
  return false;
}
