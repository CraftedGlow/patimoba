import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { finalizeCouponDelivery } from "@/lib/coupons";
import { authorizeUserAccess } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// 注文とクーポン券の紐付け。通常は注文確定API（ec/create-order, customer/takeout-order）の
// 内部で行うが、直接呼ばれた場合も注文者本人に限定し、未決済の注文に対してのみ行う。
export async function POST(req: NextRequest) {
  try {
    const { deliveryId, orderId } = await req.json();
    if (!deliveryId || !orderId) {
      return NextResponse.json({ error: "deliveryId and orderId required" }, { status: 400 });
    }

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("customer_id")
      .eq("id", orderId)
      .maybeSingle();
    if (!order?.customer_id) {
      return NextResponse.json({ error: "order_not_found" }, { status: 404 });
    }
    const access = await authorizeUserAccess(req, supabaseAdmin, order.customer_id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const result = await finalizeCouponDelivery(deliveryId, orderId, supabaseAdmin);
    if (!result.ok) {
      return NextResponse.json({ error: result.error }, { status: 400 });
    }
    return NextResponse.json({ ok: true, couponDiscountAmount: result.couponDiscountAmount, totalAmount: result.totalAmount });
  } catch (e) {
    console.error("[coupons/finalize] error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
