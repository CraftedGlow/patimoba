import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";

async function sendLineMessage(lineUserId: string, message: string) {
  if (!LINE_CHANNEL_ACCESS_TOKEN) return;
  await fetch("https://api.line.me/v2/bot/message/push", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${LINE_CHANNEL_ACCESS_TOKEN}`,
    },
    body: JSON.stringify({
      to: lineUserId,
      messages: [{ type: "text", text: message }],
    }),
  });
}

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(`
        *,
        stores(name, phone),
        users(name, line_user_id, email),
        order_items(product_name_snapshot, quantity)
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const storeName = order.stores?.name ?? "";
    const customerName = order.users?.name ?? "";
    const lineUserId = order.users?.line_user_id ?? null;
    const email = order.users?.email ?? null;
    const pickupTime = order.pickup_time ? order.pickup_time.slice(0, 5) : "指定時間";

    const lineMessage = `📦 EC発送のお知らせ
${customerName}様

ご注文いただいた商品を、本日発送いたしました📦✨

食品のため、指定いただいたお受け取り日時にはご在宅をお願いいたします。
受取時間：${pickupTime}
通常、到着までに1〜3日程度かかります。

お受け取りまで今しばらくお待ちくださいませ😊`;

    const emailMessage = `ご注文いただいた商品を、本日発送いたしました。
食品のため、指定いただいたお受け取り時間にはご在宅をお願いいたします。
通常、到着までに1〜3日程度かかります。
お受け取りまで今しばらくお待ちください。

注文店舗：${storeName}
店舗の電話番号：${order.stores?.phone ?? ""}
注文日時：${new Date(order.created_at).toLocaleString("ja-JP")}
お名前：${customerName}
お受け取り時間：${pickupTime}`;

    if (lineUserId) {
      await sendLineMessage(lineUserId, lineMessage);
    } else if (email) {
      console.log(`[Ship Email] To: ${email}\n${emailMessage}`);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("send-ship-notification error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
