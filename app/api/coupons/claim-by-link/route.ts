import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isWithinValidPeriod, formatDiscount } from "@/lib/coupons";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { token, userId } = await req.json();
    if (!token || !userId) {
      return NextResponse.json({ error: "token and userId required" }, { status: 400 });
    }

    const { data: coupon } = await supabaseAdmin
      .from("coupons")
      .select("id, title, discount_type, discount_value, is_active, valid_from, expires_at")
      .eq("share_token", token)
      .maybeSingle();

    if (!coupon || !coupon.is_active) {
      return NextResponse.json({ error: "coupon_not_found" }, { status: 404 });
    }

    if (!isWithinValidPeriod(coupon, new Date())) {
      return NextResponse.json({ error: "coupon_out_of_period" }, { status: 400 });
    }

    // unique(coupon_id, user_id) 制約により二重取得は自然に無視される
    const { error } = await supabaseAdmin
      .from("coupon_deliveries")
      .insert({ coupon_id: coupon.id, user_id: userId, claim_method: "link" });

    if (error && error.code !== "23505") {
      console.error("[coupons/claim-by-link] insert error:", error);
      return NextResponse.json({ error: "claim_failed" }, { status: 500 });
    }

    return NextResponse.json({
      ok: true,
      coupon: { title: coupon.title, discountLabel: formatDiscount(coupon) },
    });
  } catch (e) {
    console.error("[coupons/claim-by-link] error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
