import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { authorizeUserAccess } from "@/lib/api-auth";
import { createOrderAccessKey } from "@/lib/signed-value";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@example.com";

// POST /api/email/send-ec-order-confirmation
// body: { orderId }
// 店舗名義のメールになるため、本文・宛先はリクエストボディではなく DB の注文データのみから組み立てる。
// 注文者本人（またはゲスト）からの呼び出しに限り、1注文につき1回だけ送信する。
export async function POST(req: NextRequest) {
  try {
    const { orderId }: { orderId: string } = await req.json();

    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(`
        *,
        stores(name, phone),
        users!orders_customer_id_fkey(name, email, phone),
        order_items(product_name_snapshot, quantity, unit_price)
      `)
      .eq("id", orderId)
      .maybeSingle();

    if (!order || order.order_type !== "ec" || !order.customer_id) {
      return NextResponse.json({ error: "Order not found" }, { status: 404 });
    }

    const access = await authorizeUserAccess(req, supabaseAdmin, order.customer_id);
    if (!access.ok) {
      return NextResponse.json({ error: access.error }, { status: access.status });
    }

    const toEmail: string | null = order.users?.email ?? order.guest_email ?? null;
    if (!toEmail) return NextResponse.json({ skipped: "no email on file" });

    // 送信済みフラグを原子的に立て、重複送信を防ぐ
    const { data: claimed, error: claimErr } = await supabaseAdmin
      .from("orders")
      .update({ confirmation_email_sent_at: new Date().toISOString() })
      .eq("id", orderId)
      .is("confirmation_email_sent_at", null)
      .select("id")
      .maybeSingle();
    if (claimErr) {
      console.error("[send-ec-order-confirmation] 送信済みフラグ更新エラー:", claimErr);
      return NextResponse.json({ error: "Internal error" }, { status: 500 });
    }
    if (!claimed) return NextResponse.json({ skipped: "already sent" });

    const customerName: string = order.customer_name_snapshot || order.users?.name || "";
    const customerPhone: string = order.users?.phone ?? "";
    const deliveryTime: string = order.delivery_time_slot ?? "";

    const storeName: string = order.stores?.name ?? "";
    const storePhone: string = order.stores?.phone ?? "";
    const orderDate = new Date(order.created_at).toLocaleString("ja-JP", {
      timeZone: "Asia/Tokyo",
      year: "numeric",
      month: "long",
      day: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });

    const addrStr = order.shipping_prefecture
      ? `〒${order.shipping_postal_code ?? ""} ${order.shipping_prefecture}${order.shipping_city ?? ""}${order.shipping_address ?? ""}${order.shipping_building ? " " + order.shipping_building : ""}`
      : "未入力";

    const itemsText = (order.order_items ?? [])
      .map((i: { product_name_snapshot: string; quantity: number }) => `・${i.product_name_snapshot} ×${i.quantity}`)
      .join("\n");

    const totalAmount = Number(order.total_amount).toLocaleString();
    const shippingFeeStr = Number(order.shipping_fee) === 0 ? "無料" : `${Number(order.shipping_fee).toLocaleString()}円`;

    const host = req.headers.get("host") ?? "order.patisseriemobile.com";
    const proto = host.startsWith("localhost") ? "http" : "https";
    const siteUrl = process.env.NEXT_PUBLIC_SITE_URL ?? `${proto}://${host}`;
    // メールはLINEの外（ログインしていないブラウザ）で開かれることが多いため、
    // この注文専用の鍵を付けて、ログインなしで確認・キャンセルできるようにする
    const orderDetailUrl = `${siteUrl}/customer/orders/${orderId}?key=${encodeURIComponent(createOrderAccessKey(orderId))}`;
    const cancelDeadlineStr = order.cancel_deadline_at
      ? new Date(order.cancel_deadline_at).toLocaleString("ja-JP", {
          timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
        })
      : null;

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
配送料：${shippingFeeStr}
合計金額（税込）：${totalAmount}円

配送時間帯：${deliveryTime || "未指定"}
お支払い方法：クレジットカード
-------------------------------
【ご注文内容の確認・キャンセル】
下記URLからご注文内容の確認${cancelDeadlineStr ? `、および ${cancelDeadlineStr} までのキャンセル` : ""}が可能です。
${orderDetailUrl}
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
      // 送信に失敗した場合は再送できるようフラグを戻す
      await supabaseAdmin.from("orders").update({ confirmation_email_sent_at: null }).eq("id", orderId);
      return NextResponse.json({ error: "メール送信に失敗しました" }, { status: 500 });
    }

    return NextResponse.json({ success: true, sentTo: toEmail });
  } catch (e) {
    console.error("send-ec-order-confirmation error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
