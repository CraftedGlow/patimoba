import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { reserveCoupon } from "@/lib/coupons";
import { authorizeUserAccess } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// クーポン券の予約（使用済み化）。ここでの割引額はプレビュー用で、
// 実際の割引額は注文確定時（finalizeCouponDelivery）に DB 上の注文小計から再計算される。
export async function POST(req: NextRequest) {
  try {
    const { couponId, userId, storeId, subtotal, productIds } = await req.json();
    if (!couponId || !userId || !storeId || typeof subtotal !== "number") {
      return NextResponse.json({ error: "couponId, userId, storeId, subtotal required" }, { status: 400 });
    }

    // 他人のクーポン券を勝手に使用済みにできないよう、本人（またはゲスト行）に限定する
    const access = await authorizeUserAccess(req, supabaseAdmin, userId);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const result = await reserveCoupon(
      { couponId, userId, storeId, subtotal, productIds: Array.isArray(productIds) ? productIds : [] },
      supabaseAdmin
    );

    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }

    return NextResponse.json({
      deliveryId: result.deliveryId,
      discountAmount: result.discountAmount,
      couponTitle: result.coupon.title,
    });
  } catch (e) {
    console.error("[coupons/apply] error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
