import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { reserveCoupon } from "@/lib/coupons";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { couponId, userId, storeId, subtotal, productIds } = await req.json();
    if (!couponId || !userId || !storeId || typeof subtotal !== "number") {
      return NextResponse.json({ error: "couponId, userId, storeId, subtotal required" }, { status: 400 });
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
