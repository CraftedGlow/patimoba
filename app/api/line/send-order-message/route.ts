import { NextRequest, NextResponse } from "next/server";
import { sendOrderLineMessage } from "@/lib/line";

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    await sendOrderLineMessage(orderId);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("send-order-message error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
