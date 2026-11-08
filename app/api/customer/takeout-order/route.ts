import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authorizeUserAccess } from "@/lib/api-auth";
import { isDevOnlyStoreVisible } from "@/lib/store-visibility";
import { releaseCouponReservation } from "@/lib/coupons";
import { priceCartItems, priceBag, type IncomingCartItem } from "@/lib/server/cart-pricing";
import {
  completeOrder,
  findOrderByClientRequestId,
  insertOrderLines,
  isClientRequestIdConflict,
  isValidClientRequestId,
  rollbackOrder,
} from "@/lib/server/order-checkout";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

/** キャンセル期限: 受取日の2日前 23:59:59 JST（= 14:59:59 UTC）。受取日未定の場合は7日後 */
function cancelDeadlineFor(pickupDate: string | null): string {
  if (pickupDate) {
    const [y, m, d] = pickupDate.split("-").map(Number);
    return new Date(Date.UTC(y, m - 1, d - 2, 14, 59, 59)).toISOString();
  }
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString();
}

const str = (v: unknown, max: number) => (typeof v === "string" && v.length > 0 ? v.slice(0, max) : null);

// POST /api/customer/takeout-order
// テイクアウト注文をサーバー側で作成・確定する（/api/ec/create-order と同じ方針）。
// 金額（商品・オプション・袋・ポイント・クーポン）はクライアント申告値を使わずDBの定義から再計算し、
// 注文・明細・オプションを service role で作成したうえで、クーポン確定 → 合計の照合（expectedTotal）→
// カード払いなら課金して決済済みに → ポイント反映 の順に確定する。途中で失敗した場合は注文ごと取り消す。
// clientRequestId（会計画面が注文確定の試行ごとに生成するUUID）で再送時の二重注文・二重課金を防ぐ。
export async function POST(req: NextRequest) {
  try {
    const body = await req.json();
    const {
      clientRequestId,
      storeId,
      customerId,
      customerName,
      paymentMethod,
      items,
      bag,
      discountAmount,
      couponId,
      couponDeliveryId: rawCouponDeliveryId,
      pickupDate: rawPickupDate,
      pickupTime,
      notes,
      guestEmail,
      expectedTotal,
    }: {
      clientRequestId: string;
      storeId: string;
      customerId: string;
      customerName?: string | null;
      paymentMethod: "credit" | "store";
      items: IncomingCartItem[];
      bag?: { id: string; quantity: number } | null;
      discountAmount?: number;
      couponId?: string | null;
      couponDeliveryId?: string | null;
      pickupDate?: string | null;
      pickupTime?: string | null;
      notes?: string;
      guestEmail?: string | null;
      expectedTotal: number;
    } = body;
    const couponDeliveryId = typeof rawCouponDeliveryId === "string" && rawCouponDeliveryId ? rawCouponDeliveryId : null;

    if (
      !storeId ||
      !customerId ||
      !Array.isArray(items) ||
      items.length === 0 ||
      typeof expectedTotal !== "number" ||
      !isValidClientRequestId(clientRequestId) ||
      (paymentMethod !== "credit" && paymentMethod !== "store")
    ) {
      return NextResponse.json(
        { error: "storeId, customerId, items, paymentMethod, expectedTotal, clientRequestId are required" },
        { status: 400 }
      );
    }

    // 他人（本物のアカウント）になりすまして注文・課金できないよう、本人またはゲスト行に限定する
    const access = await authorizeUserAccess(req, supabaseAdmin, customerId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    // 同じ試行の再送（応答が届かなかった場合など）は、作成済みの注文の結果を返す
    const existing = await findOrderByClientRequestId(supabaseAdmin, clientRequestId, customerId);
    if (existing.kind === "completed") {
      return NextResponse.json({ orderId: existing.orderId, totalAmount: existing.totalAmount, duplicate: true });
    }
    if (existing.kind === "conflict") {
      return NextResponse.json({ error: existing.error, code: existing.code }, { status: existing.status });
    }

    // 以降の早期エラーではクーポン予約を解放してから返す
    const fail = async (error: string, status: number) => {
      if (couponDeliveryId) await releaseCouponReservation(couponDeliveryId, supabaseAdmin);
      return NextResponse.json({ error }, { status });
    };

    // EC商品はテイクアウト注文と同時に注文できない（EC注文は /api/ec/create-order）
    if (items.some((i) => i?.isEc === true)) {
      return fail("EC商品とテイクアウト商品は同時に注文できません", 400);
    }

    // 開発用の架空店舗は本番環境では注文を作成できない
    const { data: storeRow } = await supabaseAdmin
      .from("stores")
      .select("is_dev_only, tenant_id")
      .eq("id", storeId)
      .maybeSingle();
    if (!storeRow || !isDevOnlyStoreVisible(storeRow.is_dev_only)) {
      return fail("この店舗では注文できません", 400);
    }

    const payByCard = paymentMethod === "credit";
    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("customer_id, points")
      .eq("id", customerId)
      .maybeSingle();
    if (!userRow) return fail("お客様情報が見つかりませんでした", 400);
    if (payByCard && !userRow.customer_id) return fail("カード情報が登録されていません", 400);
    if (payByCard && !storeRow.tenant_id) return fail("店舗のテナント情報が設定されていません", 400);

    if ((couponId && !couponDeliveryId) || (!couponId && couponDeliveryId)) {
      return fail("coupon_reservation_invalid", 400);
    }

    // 商品・オプション・袋の価格はDBから再計算する
    const pricing = await priceCartItems(supabaseAdmin, storeId, items, "takeout");
    if (!pricing.ok) return fail(pricing.error, 400);
    const bagPricing = await priceBag(supabaseAdmin, storeId, bag, pricing.items.map((i) => i.productId));
    if (!bagPricing.ok) return fail(bagPricing.error, 400);
    const pricedBag = bagPricing.bag;
    const subtotal = pricing.subtotal + (pricedBag ? pricedBag.unitPrice * pricedBag.quantity : 0);

    // ポイント利用は実際の保有ポイントの範囲内に限る
    const usedPoints = Number(discountAmount ?? 0);
    if (!Number.isInteger(usedPoints) || usedPoints < 0 || usedPoints > subtotal || usedPoints > (Number(userRow.points) || 0)) {
      return fail("ご利用ポイントが不正です。お手数ですが再度お試しください。", 400);
    }

    const pickupDate = typeof rawPickupDate === "string" && DATE_RE.test(rawPickupDate) ? rawPickupDate : null;
    if (rawPickupDate && !pickupDate) return fail("受け取り日が不正です", 400);

    // プリントデコレーション用の写真はカート内のホールケーキに添付されたもの（従来どおり最初の1枚）
    const printPhotoUrl = str(items.find((i) => i?.customization?.printPhotoUrl)?.customization?.printPhotoUrl, 2000);

    // 決済完了まではいったん未決済で作成する（クーポン割引は completeOrder で反映）
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        store_id: storeId,
        customer_id: customerId,
        customer_name_snapshot: str(customerName, 100),
        order_type: "takeout",
        order_status: "pending",
        payment_status: "unpaid",
        payment_method: paymentMethod,
        subtotal,
        discount_amount: usedPoints,
        coupon_id: null,
        coupon_discount_amount: 0,
        total_amount: Math.max(0, subtotal - usedPoints),
        pickup_date: pickupDate,
        pickup_time: str(pickupTime, 20),
        notes: str(notes, 2000) ?? "",
        print_photo_url: printPhotoUrl,
        guest_email: str(guestEmail, 254),
        cancel_deadline_at: cancelDeadlineFor(pickupDate),
        client_request_id: clientRequestId,
      })
      .select("id, total_amount")
      .single();

    if (orderErr || !order) {
      // 同じ試行の要求が同時に届いた場合（もう一方が作成中）。クーポン予約はもう一方が使うため解放しない
      if (isClientRequestIdConflict(orderErr)) {
        const again = await findOrderByClientRequestId(supabaseAdmin, clientRequestId, customerId);
        if (again.kind === "completed") {
          return NextResponse.json({ orderId: again.orderId, totalAmount: again.totalAmount, duplicate: true });
        }
        if (again.kind === "conflict") {
          return NextResponse.json({ error: again.error, code: again.code }, { status: again.status });
        }
      }
      console.error("[takeout-order] 注文作成エラー:", orderErr);
      return fail("注文の作成に失敗しました", 500);
    }

    // 例外時も注文が残らないよう、失敗扱いにして取り消す
    const lines = await insertOrderLines(supabaseAdmin, order.id, pricing.items, pricedBag).catch((e: unknown) => ({ ok: false as const, error: e }));
    if (!lines.ok) {
      console.error("[takeout-order] 明細作成エラー:", lines.error);
      await rollbackOrder(supabaseAdmin, order.id, couponDeliveryId);
      return NextResponse.json({ error: "注文の作成に失敗しました" }, { status: 500 });
    }

    const result = await completeOrder(supabaseAdmin, {
      orderId: order.id,
      initialTotal: Number(order.total_amount),
      couponDeliveryId,
      expectedTotal,
      // 付与は確定合計100円につき0.5pt（会計画面の表示と同じ計算）
      earnedPoints: (totalAmount) => Math.floor(totalAmount / 200),
      charge: payByCard ? { payjpCustomerId: userRow.customer_id, tenantId: storeRow.tenant_id } : null,
      logTag: "takeout-order",
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, ...(result.code ? { code: result.code } : {}) }, { status: result.status });
    }

    return NextResponse.json({ orderId: order.id, totalAmount: result.totalAmount });
  } catch (e) {
    console.error("[takeout-order] 例外:", e);
    return NextResponse.json({ error: "注文処理中にエラーが発生しました" }, { status: 500 });
  }
}
