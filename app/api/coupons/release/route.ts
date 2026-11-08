import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { releaseCouponReservation } from "@/lib/coupons";
import { authorizeUserAccess } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 注文確定に失敗したときのクーポン予約の解放。
// 券の保持者本人に限定し、割引付きの有効な注文が残っている券は解放しない（releaseCouponReservation 内で判定）。
export async function POST(req: NextRequest) {
  try {
    const { deliveryId } = await req.json();
    if (!deliveryId) {
      return NextResponse.json({ error: "deliveryId required" }, { status: 400 });
    }

    const { data: delivery } = await supabaseAdmin
      .from("coupon_deliveries")
      .select("user_id")
      .eq("id", deliveryId)
      .maybeSingle();
    if (!delivery?.user_id) {
      return NextResponse.json({ error: "not_found" }, { status: 404 });
    }
    const access = await authorizeUserAccess(req, supabaseAdmin, delivery.user_id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    await releaseCouponReservation(deliveryId, supabaseAdmin);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[coupons/release] error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
