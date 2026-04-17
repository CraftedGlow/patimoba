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

    // 注文情報を取得
    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(`
        *,
        stores(name, phone, address),
        users(name, line_user_id, email),
        order_items(product_name_snapshot, quantity, unit_price)
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const storeName = order.stores?.name ?? "";
    const storePhone = order.stores?.phone ?? "";
    const customerName = order.users?.name ?? "";
    const lineUserId = order.users?.line_user_id ?? null;
    const email = order.users?.email ?? null;

    const itemsText = (order.order_items || [])
      .map((i: any) => `・${i.product_name_snapshot} ×${i.quantity}`)
      .join("\n");

    const pickupDate = order.pickup_date
      ? new Date(order.pickup_date).toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "long",
          day: "numeric",
          weekday: "short",
        })
      : "";
    const pickupTime = order.pickup_time ? order.pickup_time.slice(0, 5) : "";
    const pickupStr = [pickupDate, pickupTime].filter(Boolean).join(" ");

    const lineMessage = `ご注文ありがとうございます！このメッセージを来店時にお見せください！

お名前: ${customerName}
店舗名: ${storeName}
来店日時: ${pickupStr}

注文商品：
${itemsText}

合計金額：${Number(order.total_amount).toLocaleString()}円

${storeName}の電話番号
${storePhone}
※キャンセル・変更の場合は記載されている電話番号にご連絡ください。
無断キャンセルの場合は料金の100%をお支払いいただきます。`;

    if (lineUserId) {
      await sendLineMessage(lineUserId, lineMessage);
    } else if (email) {
      // メール送信（実装時に適切なメールサービスに変更）
      console.log(`[Email fallback] To: ${email}\n${lineMessage}`);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("send-order-message error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
