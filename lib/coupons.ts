import { resolveStoreLineConfig } from "@/lib/line";
import { resolveEffectiveLiffId } from "@/lib/store-liff";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

export interface Coupon {
  id: string;
  store_id: string;
  title: string;
  discount_type: "percentage" | "fixed";
  discount_value: number;
  valid_from: string | null;
  expires_at: string | null;
  min_order_amount: number | null;
  whole_cake_only: boolean;
  is_active: boolean;
  share_token: string;
  is_anniversary_coupon: boolean;
}

export function formatDiscount(c: Pick<Coupon, "discount_type" | "discount_value">) {
  return c.discount_type === "percentage"
    ? `${c.discount_value}% OFF`
    : `${c.discount_value.toLocaleString()}円引き`;
}

/**
 * クーポン受け取り用のLIFFリンク付きFlex Message（カード型リッチメッセージ）を組み立てる。
 * ボタンを押すとそのままLIFFの注文アプリに遷移し、クーポンが自動で紐付いた状態で注文に進める。
 */
export function buildCouponFlexMessage(
  coupon: Pick<Coupon, "title" | "discount_type" | "discount_value" | "expires_at" | "share_token">,
  liffId: string,
  heading = "クーポン"
) {
  const expiryLabel = coupon.expires_at
    ? `${new Date(coupon.expires_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })}まで`
    : "無期限";
  const url = `https://liff.line.me/${liffId}?coupon=${coupon.share_token}`;

  return {
    type: "flex",
    altText: `【${heading}のお知らせ🎁】${coupon.title}`,
    contents: {
      type: "bubble",
      body: {
        type: "box",
        layout: "vertical",
        spacing: "sm",
        contents: [
          { type: "text", text: `🎁 ${heading}`, weight: "bold", size: "sm", color: "#d97706" },
          { type: "text", text: coupon.title, weight: "bold", size: "lg", wrap: true, margin: "sm" },
          { type: "text", text: formatDiscount(coupon), weight: "bold", size: "xxl", color: "#d97706", margin: "md" },
          { type: "text", text: `有効期限：${expiryLabel}`, size: "sm", color: "#666666", margin: "md" },
        ],
      },
      footer: {
        type: "box",
        layout: "vertical",
        contents: [
          {
            type: "button",
            style: "primary",
            color: "#fbbf24",
            action: { type: "uri", label: "クーポンを受け取って注文する", uri: url },
          },
        ],
      },
    },
  };
}

export function calcCouponDiscountAmount(coupon: Pick<Coupon, "discount_type" | "discount_value">, subtotal: number) {
  const raw =
    coupon.discount_type === "percentage"
      ? Math.floor((subtotal * coupon.discount_value) / 100)
      : coupon.discount_value;
  return Math.max(0, Math.min(raw, subtotal));
}

export function isWithinValidPeriod(coupon: Pick<Coupon, "valid_from" | "expires_at">, now: Date) {
  if (coupon.valid_from && now < new Date(coupon.valid_from)) return false;
  if (coupon.expires_at && now > new Date(coupon.expires_at)) return false;
  return true;
}

export interface ReserveCouponInput {
  couponId: string;
  userId: string;
  storeId: string;
  subtotal: number;
  productIds: string[];
}

export type ReserveCouponResult =
  | { ok: true; deliveryId: string; discountAmount: number; coupon: Coupon }
  | { ok: false; error: string };

/**
 * クーポンの利用条件（有効期間・最低金額・ホールケーキ限定）と
 * ユーザーが未使用の券を保持しているかをサーバー側で検証し、
 * 原子的な UPDATE で即時「使用済み」にして二重利用を防ぐ。
 * 注文作成が失敗した場合は releaseCouponReservation で戻す。
 */
export async function reserveCoupon(
  input: ReserveCouponInput,
  supabaseAdmin: AdminClient
): Promise<ReserveCouponResult> {
  const [{ data: coupon }, { data: delivery }] = await Promise.all([
    supabaseAdmin.from("coupons").select("*").eq("id", input.couponId).eq("store_id", input.storeId).maybeSingle(),
    supabaseAdmin
      .from("coupon_deliveries")
      .select("id, used_at")
      .eq("coupon_id", input.couponId)
      .eq("user_id", input.userId)
      .maybeSingle(),
  ]);

  if (!coupon) return { ok: false, error: "coupon_not_found" };
  if (!coupon.is_active) return { ok: false, error: "coupon_inactive" };
  if (!isWithinValidPeriod(coupon, new Date())) return { ok: false, error: "coupon_out_of_period" };
  if (coupon.min_order_amount && input.subtotal < coupon.min_order_amount) {
    return { ok: false, error: "coupon_min_order_amount_not_met" };
  }

  if (coupon.whole_cake_only) {
    const productIds = input.productIds.filter(Boolean);
    if (productIds.length === 0) return { ok: false, error: "coupon_whole_cake_only" };
    const { data: wholeCakeProducts } = await supabaseAdmin
      .from("products")
      .select("id")
      .in("id", productIds)
      .eq("store_id", input.storeId)
      .eq("is_preorder_required", true);
    if (!wholeCakeProducts || wholeCakeProducts.length === 0) {
      return { ok: false, error: "coupon_whole_cake_only" };
    }
  }

  if (!delivery) return { ok: false, error: "coupon_not_held" };
  if (delivery.used_at) return { ok: false, error: "coupon_already_used" };

  const discountAmount = calcCouponDiscountAmount(coupon, input.subtotal);

  // 割引額はここでサーバー側計算した値を coupon_deliveries に固定保存する。
  // 注文作成側はこの保存値だけを正として使い、クライアント申告の割引額は一切信用しない。
  const { data: reserved, error: reserveErr } = await supabaseAdmin
    .from("coupon_deliveries")
    .update({ used_at: new Date().toISOString(), discount_amount: discountAmount })
    .eq("id", delivery.id)
    .is("used_at", null)
    .select("id")
    .maybeSingle();

  if (reserveErr || !reserved) return { ok: false, error: "coupon_already_used" };

  return { ok: true, deliveryId: reserved.id, discountAmount, coupon };
}

export async function releaseCouponReservation(deliveryId: string, supabaseAdmin: AdminClient) {
  await supabaseAdmin
    .from("coupon_deliveries")
    .update({ used_at: null, order_id: null, discount_amount: 0 })
    .eq("id", deliveryId)
    .is("order_id", null);
}

/**
 * 注文作成後にクーポン券を注文へ確定紐付けする。
 * reserveCoupon で保存済みの discount_amount を正として orders.coupon_discount_amount / total_amount を
 * 上書き訂正する（takeoutはクライアント直接insertのため、注文作成時点の値をここで必ず正しい値に補正する）。
 */
export async function finalizeCouponDelivery(deliveryId: string, orderId: string, supabaseAdmin: AdminClient) {
  const { data: delivery } = await supabaseAdmin
    .from("coupon_deliveries")
    .update({ order_id: orderId })
    .eq("id", deliveryId)
    .not("used_at", "is", null)
    .select("discount_amount")
    .maybeSingle();

  if (!delivery) return;

  const { data: order } = await supabaseAdmin
    .from("orders")
    .select("subtotal, discount_amount, shipping_fee")
    .eq("id", orderId)
    .maybeSingle();
  if (!order) return;

  const correctedTotal =
    Math.max(0, order.subtotal - (order.discount_amount ?? 0) - delivery.discount_amount) + (order.shipping_fee ?? 0);

  await supabaseAdmin
    .from("orders")
    .update({ coupon_discount_amount: delivery.discount_amount, total_amount: correctedTotal })
    .eq("id", orderId);
}

export type EnsureCouponDeliveryStatus = "issued" | "held" | "used";

// 記念日リマインダーは毎年繰り返し送られるため、これより古い使用済みクーポンは
// 「去年以前に使われたもの」とみなし、新しい年のぶんとして再付与する。
const ANNIVERSARY_REISSUE_AFTER_DAYS = 300;

/**
 * 記念日リマインダーなど、単発メッセージにクーポンを添えて配る場合の付与処理。
 * まだ持っていなければ新規付与し、既に持っていれば重複させず、
 * 直近で使用済みなら再度案内しないよう "used" を返す。
 * ただし十分古い（前年以前とみなせる）使用済みクーポンは、新しい年のぶんとして自動的に再付与する。
 */
export async function ensureCouponDeliveryForReminder(
  couponId: string,
  userId: string,
  supabaseAdmin: AdminClient
): Promise<EnsureCouponDeliveryStatus> {
  const { data: existing } = await supabaseAdmin
    .from("coupon_deliveries")
    .select("id, used_at")
    .eq("coupon_id", couponId)
    .eq("user_id", userId)
    .maybeSingle();

  if (existing) {
    if (!existing.used_at) return "held";

    const usedDaysAgo = (Date.now() - new Date(existing.used_at).getTime()) / (24 * 3600 * 1000);
    if (usedDaysAgo < ANNIVERSARY_REISSUE_AFTER_DAYS) return "used";

    await supabaseAdmin
      .from("coupon_deliveries")
      .update({ used_at: null, order_id: null, discount_amount: 0 })
      .eq("id", existing.id);
    return "issued";
  }

  await supabaseAdmin.from("coupon_deliveries").insert({ coupon_id: couponId, user_id: userId, claim_method: "push" });
  return "issued";
}

export interface AudienceMember {
  id: string;
  gender: string | null;
}

/**
 * 配信対象になりうる母集団（この店舗のLIFFでログイン済み＝LINEユーザーIDが取得できている顧客）を返す。
 * 注文実績の有無は問わない。「注文実績がある人のみ」で絞り込みたい場合は
 * resolveOrderedCustomerIds の結果と組み合わせる。
 */
export async function resolveStoreAudience(storeId: string, supabaseAdmin: AdminClient): Promise<AudienceMember[]> {
  const liffId = await resolveEffectiveLiffId(storeId, supabaseAdmin);
  if (!liffId) return [];

  const { data } = await supabaseAdmin
    .from("users")
    .select("id, gender")
    .eq("liff_id", liffId)
    .not("line_user_id", "is", null)
    .order("created_at", { ascending: false });

  return (data ?? []).map((u: { id: string; gender: string | null }) => ({ id: u.id, gender: u.gender ?? null }));
}

/** その店舗で注文実績があるユーザーIDの集合を返す（「注文実績がある人のみ」フィルタ用） */
export async function resolveOrderedCustomerIds(storeId: string, supabaseAdmin: AdminClient): Promise<Set<string>> {
  const { data } = await supabaseAdmin
    .from("orders")
    .select("customer_id")
    .eq("store_id", storeId)
    .not("customer_id", "is", null);

  const ids: Set<string> = new Set();
  (data ?? []).forEach((r: { customer_id: string | null }) => {
    if (r.customer_id) ids.add(r.customer_id);
  });
  return ids;
}

export interface SendCouponResult {
  sent: number;
  failed: number;
  skipped: number;
  error?: string;
}

/**
 * 対象ユーザーにクーポンをLINE pushメッセージで送り、成功分を coupon_deliveries に記録する。
 * 管理画面の即時送信ボタンと配信スケジュールcronの両方から使う共通ロジック。
 */
export async function sendCouponPush(
  couponId: string,
  storeId: string,
  userIds: string[],
  claimMethod: "push",
  supabaseAdmin: AdminClient
): Promise<SendCouponResult> {
  const [{ data: coupon }, lineConfig, { data: users }] = await Promise.all([
    supabaseAdmin.from("coupons").select("*").eq("id", couponId).eq("store_id", storeId).maybeSingle(),
    resolveStoreLineConfig(storeId, supabaseAdmin),
    supabaseAdmin.from("users").select("id, name, line_user_id").in("id", userIds),
  ]);

  if (!coupon) {
    return { sent: 0, failed: 0, skipped: 0, error: "coupon_not_found" };
  }
  if (!lineConfig.channelAccessToken) {
    return { sent: 0, failed: 0, skipped: 0, error: "line_channel_not_configured" };
  }

  const discountLabel = formatDiscount(coupon);
  const expiryLabel = coupon.expires_at
    ? new Date(coupon.expires_at).toLocaleDateString("ja-JP", { year: "numeric", month: "long", day: "numeric" })
    : "なし";

  const eligibleUsers = (users ?? []).filter((u: { line_user_id: string | null }) => !!u.line_user_id) as {
    id: string;
    name: string | null;
    line_user_id: string;
  }[];
  const skippedNoLine = (users ?? []).length - eligibleUsers.length;

  const { data: existingDeliveries } = eligibleUsers.length
    ? await supabaseAdmin
        .from("coupon_deliveries")
        .select("user_id")
        .eq("coupon_id", couponId)
        .in("user_id", eligibleUsers.map((u) => u.id))
    : { data: [] as { user_id: string }[] };
  const alreadyDeliveredUserIds = new Set((existingDeliveries ?? []).map((d: { user_id: string }) => d.user_id));

  const sendableUsers = eligibleUsers.filter((u) => !alreadyDeliveredUserIds.has(u.id));
  const skippedAlreadyDelivered = eligibleUsers.length - sendableUsers.length;

  const results = await Promise.allSettled(
    sendableUsers.map(async (u) => {
      const name = u.name ? `${u.name} 様` : "お客様";
      const message =
        `【クーポンのお知らせ🎁】\n\n${name}\n\n` +
        `「${coupon.title}」をお届けします✨\n\n` +
        `割引内容：${discountLabel}\n` +
        `有効期限：${expiryLabel}\n\n` +
        `ご注文の際にアプリ内でクーポンをお選びください🎂`;

      const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lineConfig.channelAccessToken}`,
        },
        body: JSON.stringify({ to: u.line_user_id, messages: [{ type: "text", text: message }] }),
      });
      if (!res.ok) {
        const body = await res.text();
        throw new Error(`LINE push failed for user ${u.id}: ${body}`);
      }
      return u.id;
    })
  );

  const sentUserIds = results
    .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
    .map((r) => r.value);

  if (sentUserIds.length > 0) {
    await supabaseAdmin
      .from("coupon_deliveries")
      .insert(sentUserIds.map((userId) => ({ coupon_id: couponId, user_id: userId, claim_method: claimMethod })));
  }

  const failed = results.filter((r) => r.status === "rejected").length;
  return { sent: sentUserIds.length, failed, skipped: skippedNoLine + skippedAlreadyDelivered };
}
