import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { finalizeCouponDelivery } from "@/lib/coupons";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { deliveryId, orderId } = await req.json();
    if (!deliveryId || !orderId) {
      return NextResponse.json({ error: "deliveryId and orderId required" }, { status: 400 });
    }
    await finalizeCouponDelivery(deliveryId, orderId, supabaseAdmin);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[coupons/finalize] error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
