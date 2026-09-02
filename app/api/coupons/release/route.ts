import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { releaseCouponReservation } from "@/lib/coupons";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { deliveryId } = await req.json();
    if (!deliveryId) {
      return NextResponse.json({ error: "deliveryId required" }, { status: 400 });
    }
    await releaseCouponReservation(deliveryId, supabaseAdmin);
    return NextResponse.json({ ok: true });
  } catch (e) {
    console.error("[coupons/release] error:", e);
    return NextResponse.json({ error: "internal_error" }, { status: 500 });
  }
}
