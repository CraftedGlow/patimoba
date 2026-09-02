import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { page, url, hasPendingCouponToken, note } = await req.json();
    await supabaseAdmin.from("liff_debug_log").insert({
      page,
      url,
      has_pending_coupon_token: hasPendingCouponToken,
      note,
    });
    return NextResponse.json({ ok: true });
  } catch {
    return NextResponse.json({ ok: true });
  }
}
