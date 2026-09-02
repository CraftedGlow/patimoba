import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const userId = req.nextUrl.searchParams.get("userId");
  const storeId = req.nextUrl.searchParams.get("storeId");
  if (!userId || !storeId) {
    return NextResponse.json({ error: "userId and storeId required" }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from("coupon_deliveries")
    .select("id, coupon:coupons!inner(id, title, discount_type, discount_value, valid_from, expires_at, min_order_amount, whole_cake_only, is_active, store_id)")
    .eq("user_id", userId)
    .eq("coupon.store_id", storeId)
    .eq("coupon.is_active", true)
    .is("used_at", null);

  if (error) {
    console.error("[coupons/my-coupons] error:", error);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }

  const coupons = (data ?? [])
    .filter((row: any) => row.coupon)
    .map((row: any) => ({
      deliveryId: row.id,
      couponId: row.coupon.id,
      title: row.coupon.title,
      discountType: row.coupon.discount_type,
      discountValue: row.coupon.discount_value,
      validFrom: row.coupon.valid_from,
      expiresAt: row.coupon.expires_at,
      minOrderAmount: row.coupon.min_order_amount,
      wholeCakeOnly: row.coupon.whole_cake_only,
    }));

  return NextResponse.json({ coupons });
}
