import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@example.com";

interface ShippingAddress {
  postalCode: string;
  prefecture: string;
  city: string;
  address: string;
  building: string;
}

export async function POST(req: NextRequest) {
  try {
    const {
      orderId,
      customerName,
      customerPhone,
      shippingAddress,
      deliveryTime,
      guestEmail,
    }: {
      orderId: string;
      customerName: string;
      customerPhone: string;
      shippingAddress: ShippingAddress | null;
      deliveryTime: string;
      guestEmail?: string | null;
    } = await req.json();

    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(`
        *,
        stores(name, phone),
        users!orders_customer_id_fkey(name, email),
        order_items(product_name_snapshot, quantity, unit_price)
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const toEmail: string | null = order.users?.email ?? order.guest_email ?? guestEmail ?? null;
    if (!toEmail) return NextResponse.json({ skipped: "no email on file" });

    const storeName: string = order.stores?.name ?? "";
    const storePhone: string = order.stores?.phone ?? "";
    const orderDate = new Date(order.created_at).toLocaleString("ja-JP", {
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const addrStr = shippingAddress
      ? `〒${shippingAddress.postalCode} ${shippingAddress.prefecture}${shippingAddress.city}${shippingAddress.address}${shippingAddress.building ? " " + shippingAddress.building : ""}`
      : "未入力";

    const itemsText = (order.order_items ?? [])
      .map((i: { product_name_snapshot: string; quantity: number }) => `・${i.product_name_snapshot} ×${i.quantity}`)
      .join("\n");

    const totalAmount = Number(order.total_amount).toLocaleString();

    const body = `この度はご注文いただきありがとうございます。
以下の内容でご注文を承りました。

注文店舗：${storeName}
店舗の電話番号：${storePhone}
注文日時：${orderDate}

-------------------------------
【注文者情報】
お名前：${customerName}
電話番号：${customerPhone}
メールアドレス：${toEmail}
-------------------------------
【お届け先情報】
${addrStr}
-------------------------------
【ご注文商品】
${itemsText}
-------------------------------
合計金額（税込）：${totalAmount}円

配送時間帯：${deliveryTime || "未指定"}
お支払い方法：クレジットカード
-------------------------------

ご不明な点がございましたら、下記までご連絡ください。
${storeName}
TEL：${storePhone}`;

    const { error: sendError } = await resend.emails.send({
      from: `${storeName || "パティモバ"} <${FROM_EMAIL}>`,
      to: toEmail,
      subject: `【${storeName}】ご注文確認メール`,
      text: body,
    });

    if (sendError) {
      console.error("Resend send error:", sendError);
      return NextResponse.json({ error: sendError.message }, { status: 500 });
    }

    return NextResponse.json({ success: true, sentTo: toEmail });
  } catch (e) {
    console.error("send-ec-order-confirmation error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
