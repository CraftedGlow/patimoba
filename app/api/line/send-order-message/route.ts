import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOrderLineMessage } from "@/lib/line";
import { authorizeUserAccess } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    // 第三者が任意の注文の通知を送りつけられないよう、注文者本人に限定する
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("customer_id")
      .eq("id", orderId)
      .maybeSingle();
    if (!order?.customer_id) return NextResponse.json({ error: "Order not found" }, { status: 404 });
    const access = await authorizeUserAccess(req, supabaseAdmin, order.customer_id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    await sendOrderLineMessage(orderId);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("send-order-message error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
