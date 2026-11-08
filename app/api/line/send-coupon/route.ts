import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendCouponPush } from "@/lib/coupons";
import { authorizeStoreStaff } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { couponId, storeId, userIds } = await req.json();
    if (!couponId || !storeId || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: "couponId, storeId, userIds required" }, { status: 400 });
    }

    // クーポン付与＋LINE配信を行う操作のため、その店舗（または親のマスター店舗）のスタッフに限る。
    // クーポンがこの storeId のものであることは sendCouponPush 内で検証する（不一致なら coupon_not_found）
    const auth = await authorizeStoreStaff(req, supabaseAdmin, storeId);
    if (!auth.ok) return NextResponse.json({ error: auth.error }, { status: auth.status });

    const result = await sendCouponPush(couponId, storeId, userIds, "push", supabaseAdmin);
    if (result.error) {
      const status = result.error === "coupon_not_found" ? 404 : 400;
      return NextResponse.json({ error: result.error }, { status });
    }
    return NextResponse.json(result);
  } catch (e) {
    console.error("[send-coupon] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
