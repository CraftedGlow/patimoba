import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const LINE_CHANNEL_ACCESS_TOKEN = process.env.LINE_CHANNEL_ACCESS_TOKEN ?? "";
const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@example.com";

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
    const { orderId, customerName: bodyCustomerName } = await req.json();
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(`
        *,
        stores(name, phone),
        users!orders_customer_id_fkey(name, line_user_id, email),
        order_items(product_name_snapshot, quantity)
      `)
      .eq("id", orderId)
      .maybeSingle() as any;

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const storeName = order.stores?.name ?? "";
    const storePhone = order.stores?.phone ?? "";
    const rawName = order.customer_name_snapshot || order.users?.name || bodyCustomerName || "";
    const customerName = rawName || "お客様";
    const lineUserId = order.users?.line_user_id ?? null;
    const email: string | null = order.users?.email ?? order.guest_email ?? null;

    const notesStr: string = order.notes ?? "";
    const deliveryAddress = notesStr.split("　配送時間:")[0] || "未入力";
    const deliveryTime = notesStr.split("　配送時間:")[1] || "未指定";
    const orderDate = new Date(order.created_at).toLocaleString("ja-JP", {
      year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
    });

    const nameLabel = rawName ? `${rawName} 様` : "お客様";
    const lineMessage = `📦 EC発送のお知らせ
${nameLabel}

ご注文いただいた商品を、本日発送いたしました📦✨

お届け先：${deliveryAddress}
配送時間帯：${deliveryTime}
通常、到着までに1〜3日程度かかります。

お受け取りまで今しばらくお待ちくださいませ😊`;

    const emailBody = `${nameLabel}

ご注文いただいた商品を、本日発送いたしました。
到着まで今しばらくお待ちください。

-------------------------------
注文店舗：${storeName}
店舗の電話番号：${storePhone}
注文日時：${orderDate}
-------------------------------
【お届け先】
${deliveryAddress}
配送時間帯：${deliveryTime}
-------------------------------
通常、到着までに1〜3日程度かかります。
ご不明な点は下記までご連絡ください。

${storeName}
TEL：${storePhone}`;

    if (lineUserId) {
      await sendLineMessage(lineUserId, lineMessage);
    } else if (email) {
      const { error: sendError } = await resend.emails.send({
        from: `${storeName || "パティモバ"} <${FROM_EMAIL}>`,
        to: email,
        subject: `【${storeName}】商品を発送しました`,
        text: emailBody,
      });
      if (sendError) {
        console.error("Resend send error:", sendError);
        return NextResponse.json({ error: sendError.message }, { status: 500 });
      }
    }

    return NextResponse.json({ success: true, sentTo: email ?? "LINE" });
  } catch (e) {
    console.error("send-ship-notification error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
