import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isDevOnlyStoreVisible } from "@/lib/store-visibility";
import { releaseCouponReservation } from "@/lib/coupons";
import { authorizeUserAccess } from "@/lib/api-auth";
import { priceCartItems, type IncomingCartItem } from "@/lib/server/cart-pricing";
import {
  completeOrder,
  findOrderByClientRequestId,
  insertOrderLines,
  isClientRequestIdConflict,
  orderLinesFailure,
  isValidClientRequestId,
  resolveShippingFee,
  rollbackOrder,
} from "@/lib/server/order-checkout";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface ShippingAddress {
  postalCode: string;
  prefecture: string;
  city: string;
  address: string;
  building: string;
}

// POST /api/ec/create-order
// 金額（商品・オプション・送料・ポイント・クーポン）はすべてサーバー側で確定し、
// 注文を作成したうえでサーバー側で PAY.JP 課金して決済済みにする。
// クライアントからは決済状態・課金ID・小計などの金額は受け取らない。
// expectedTotal（画面に表示していた合計）がサーバー計算と一致しない場合は課金せずに中止する。
// clientRequestId（会計画面が注文確定の試行ごとに生成するUUID）で再送時の二重注文・二重課金を防ぐ。
export async function POST(req: NextRequest) {
  try {
    const {
      clientRequestId: rawClientRequestId,
      storeId,
      customerId,
      items,
      discountAmount,
      couponId,
      couponDeliveryId: rawCouponDeliveryId,
      notes,
      shippingAddress,
      deliveryTimeSlot,
      guestEmail,
      customerName,
      expectedTotal,
    }: {
      clientRequestId?: string | null;
      storeId: string;
      customerId: string | null;
      items: IncomingCartItem[];
      discountAmount: number;
      couponId?: string | null;
      couponDeliveryId?: string | null;
      notes?: string;
      shippingAddress?: ShippingAddress | null;
      deliveryTimeSlot?: string | null;
      guestEmail?: string | null;
      customerName?: string | null;
      expectedTotal: number;
    } = await req.json();
    const couponDeliveryId = typeof rawCouponDeliveryId === "string" && rawCouponDeliveryId ? rawCouponDeliveryId : null;

    if (!storeId || !customerId || !Array.isArray(items) || !items.length || typeof expectedTotal !== "number") {
      return NextResponse.json({ error: "storeId, customerId, items, expectedTotal are required" }, { status: 400 });
    }
    // 更新前の画面（clientRequestId を送らない）からの注文も受け付ける（その場合は冪等化なし）
    if (rawClientRequestId != null && !isValidClientRequestId(rawClientRequestId)) {
      return NextResponse.json({ error: "clientRequestId is invalid" }, { status: 400 });
    }
    const clientRequestId = rawClientRequestId ?? null;

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

    // 開発用の架空店舗は本番環境では注文を作成できない
    const { data: storeRow } = await supabaseAdmin
      .from("stores")
      .select("is_dev_only, tenant_id")
      .eq("id", storeId)
      .maybeSingle();
    if (!storeRow || !isDevOnlyStoreVisible(storeRow.is_dev_only)) {
      return fail("この店舗では注文できません", 400);
    }
    if (!storeRow.tenant_id) {
      return fail("店舗のテナント情報が設定されていません", 400);
    }

    const { data: userRow } = await supabaseAdmin
      .from("users")
      .select("customer_id, points")
      .eq("id", customerId)
      .maybeSingle();
    if (!userRow?.customer_id) {
      return fail("カード情報が登録されていません", 400);
    }

    if ((couponId && !couponDeliveryId) || (!couponId && couponDeliveryId)) {
      return fail("coupon_reservation_invalid", 400);
    }

    // 商品・オプション価格はDBから再計算する
    const pricing = await priceCartItems(supabaseAdmin, storeId, items, "ec");
    if (!pricing.ok) return fail(pricing.error, 400);
    const subtotal = pricing.subtotal;

    // ポイント利用は実際の保有ポイントの範囲内に限る
    const usedPoints = Number(discountAmount ?? 0);
    if (!Number.isInteger(usedPoints) || usedPoints < 0 || usedPoints > subtotal || usedPoints > (Number(userRow.points) || 0)) {
      return fail("ご利用ポイントが不正です。お手数ですが再度お試しください。", 400);
    }

    // 送料はクライアントの申告値を信用せず、店舗設定に基づきサーバー側で再計算する
    // （会計画面は /api/ec/shipping-fee で同じ計算結果を表示している）
    const shippingFee = await resolveShippingFee(supabaseAdmin, storeId, shippingAddress?.prefecture, subtotal);

    // EC は配送日フィールドがないため作成から24時間をキャンセル期限とする
    const cancelDeadlineAt = new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString();

    // 決済完了まではいったん未決済で作成する（クーポン割引は completeOrder で反映）
    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        store_id: storeId,
        customer_id: customerId,
        order_type: "ec",
        order_status: "pending",
        payment_status: "unpaid",
        subtotal,
        discount_amount: usedPoints,
        coupon_id: null,
        coupon_discount_amount: 0,
        total_amount: Math.max(0, subtotal - usedPoints) + shippingFee,
        shipping_fee: shippingFee,
        shipping_postal_code: shippingAddress?.postalCode ?? null,
        shipping_prefecture: shippingAddress?.prefecture ?? null,
        shipping_city: shippingAddress?.city ?? null,
        shipping_address: shippingAddress?.address ?? null,
        shipping_building: shippingAddress?.building ?? null,
        delivery_time_slot: deliveryTimeSlot ?? null,
        pickup_date: null,
        pickup_time: null,
        notes: notes ?? "",
        guest_email: guestEmail ?? null,
        customer_name_snapshot: customerName ?? null,
        cancel_deadline_at: cancelDeadlineAt,
        payjp_charge_id: null,
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
      console.error("[create-order] 注文作成エラー:", orderErr);
      return fail("注文の作成に失敗しました", 500);
    }

    // 例外時も注文が残らないよう、失敗扱いにして取り消す
    const lines = await insertOrderLines(supabaseAdmin, order.id, pricing.items, null).catch((e: unknown) => ({ ok: false as const, error: e }));
    if (!lines.ok) {
      console.error("[create-order] 明細作成エラー:", lines.error);
      await rollbackOrder(supabaseAdmin, order.id, couponDeliveryId);
      const failure = orderLinesFailure(lines.error);
      return NextResponse.json({ error: failure.error }, { status: failure.status });
    }

    const result = await completeOrder(supabaseAdmin, {
      orderId: order.id,
      initialTotal: Number(order.total_amount),
      couponDeliveryId,
      expectedTotal,
      // 付与は送料を除いた「小計 − 利用ポイント」100円につき0.5pt（会計画面の表示と同じ計算）
      earnedPoints: () => Math.floor((subtotal - usedPoints) / 200),
      charge: { payjpCustomerId: userRow.customer_id, tenantId: storeRow.tenant_id },
      logTag: "create-order",
    });
    if (!result.ok) {
      return NextResponse.json({ error: result.error, ...(result.code ? { code: result.code } : {}) }, { status: result.status });
    }

    // EC注文の通知はメール（send-ec-order-confirmation）のみで行う。LINE通知は送らない。

    return NextResponse.json({ orderId: order.id, totalAmount: result.totalAmount });
  } catch (e: any) {
    console.error("create-order error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
