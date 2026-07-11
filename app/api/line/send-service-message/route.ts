import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveStoreLineConfig } from "@/lib/line";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

async function getStatelessToken(channelId: string, channelSecret: string): Promise<string> {
  const res = await fetch("https://api.line.me/oauth2/v3/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "client_credentials",
      client_id: channelId,
      client_secret: channelSecret,
    }),
  });
  if (!res.ok) throw new Error(`stateless token error: ${res.status} ${await res.text()}`);
  const data = await res.json();
  return data.access_token;
}

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(`
        id, store_id, order_type, pickup_date, pickup_time, customer_name_snapshot, total_amount,
        service_notification_token,
        stores(name, address),
        users!orders_customer_id_fkey(name),
        order_items(product_name_snapshot, quantity, subtotal, order_item_options(option_group_name_snapshot, option_item_name_snapshot, price_delta, quantity))
      `)
      .eq("id", orderId)
      .maybeSingle() as any;

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const notificationToken: string | null = order.service_notification_token;
    if (!notificationToken) {
      console.warn(`[send-service-message] no notification token: orderId=${orderId}`);
      return NextResponse.json({ error: "No service notification token" }, { status: 422 });
    }

    const store = order.stores;
    const storeName: string = store?.name ?? "";
    const storeAddress: string = store?.address ?? "";
    const customerName: string = order.customer_name_snapshot || order.users?.name || "お客様";
    const isEc = order.order_type === "ec";

    const lineConfig = await resolveStoreLineConfig(order.store_id, supabaseAdmin);
    const liffId: string = lineConfig.liffId ?? "";
    const channelSecret: string = lineConfig.channelSecret ?? "";
    let channelAccessToken: string;

    if (liffId && channelSecret) {
      const channelId = liffId.split("-")[0];
      channelAccessToken = await getStatelessToken(channelId, channelSecret);
    } else {
      channelAccessToken = lineConfig.channelAccessToken ?? "";
    }

    if (!channelAccessToken) {
      return NextResponse.json({ error: "No channel access token available" }, { status: 500 });
    }

    const templateName = isEc
      ? (process.env.LINE_SERVICE_TEMPLATE_EC ?? "order_confirmed_ec_ja")
      : (process.env.LINE_SERVICE_TEMPLATE_TAKEOUT ?? "order_request_d_o_ja");

    // 受取日時
    let dateStr = "";
    if (order.pickup_date) {
      const d = new Date(order.pickup_date);
      dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`;
      if (order.pickup_time) dateStr += ` ${order.pickup_time.slice(0, 5)}`;
    } else {
      const now = new Date();
      dateStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`;
    }

    // 注文商品
    const items: Array<{
      product_name_snapshot: string;
      quantity: number;
      subtotal: number;
      order_item_options: Array<{
        option_group_name_snapshot: string | null;
        option_item_name_snapshot: string | null;
        price_delta: number | null;
        quantity: number | null;
      }>;
    }> = order.order_items || [];

    const orderDetail = items.map((item) => {
      const allOpts = (item.order_item_options ?? []).filter(
        (o) => o.option_group_name_snapshot !== "アレルギー"
      );
      const plateOpt = allOpts.find(o => o.option_group_name_snapshot === "メッセージプレート");
      const messageOpt = allOpts.find(o => o.option_group_name_snapshot === "メッセージ");
      const opts = allOpts.filter(o =>
        o.option_group_name_snapshot !== "メッセージプレート" &&
        o.option_group_name_snapshot !== "メッセージ"
      );

      const lines: string[] = [`${item.product_name_snapshot} ×${item.quantity}`];
      for (const opt of opts) {
        const group = opt.option_group_name_snapshot ?? "";
        const name = opt.option_item_name_snapshot ?? "";
        const price = opt.price_delta ?? 0;
        const qty = opt.quantity ?? 1;
        const totalPrice = group === "ろうそく" ? price * qty : price;

        let label: string;
        if (group === "サイズ") label = `  サイズ：${name}`;
        else if (group === "ろうそく") label = `  ろうそく：${name}${qty > 1 ? `×${qty}` : ""}`;
        else label = `  ${name}`;

        lines.push(totalPrice > 0 ? `${label}　¥${totalPrice.toLocaleString()}` : label);
      }

      if (plateOpt || messageOpt) {
        const plate = plateOpt?.option_item_name_snapshot ?? "";
        const msg = messageOpt?.option_item_name_snapshot ?? "";
        lines.push(`  メッセージ：${plate}${msg ? `「${msg}」` : ""}`);
      }

      return lines.join("\n");
    }).join("\n");

    const truncatedOrderDetail = orderDetail.length > 45
      ? orderDetail.slice(0, 45) + "..."
      : orderDetail;

    const sumStr = `¥${Number(order.total_amount || 0).toLocaleString()}（税込）`;

    const liffBase = liffId ? `https://liff.line.me/${liffId}` : "https://order.patisseriemobile.com";
    const orderDetailUrl = `${liffBase}/customer/orders/${orderId}`;
    const howToReceive = isEc
      ? "発送完了後、改めてご案内いたします。商品到着まで今しばらくお待ちください。"
      : "受け取り日時に、こちらの画面を店頭スタッフへご提示ください。";

    const params: Record<string, string> = {
      date: dateStr,
      order_detail: truncatedOrderDetail,
      shop_name: storeName,
      sum: sumStr,
      how_to_receive: howToReceive,
      btn1_url: orderDetailUrl,
    };

    const msgRes = await fetch("https://api.line.me/message/v3/notifier/send?target=service", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({ templateName, params, notificationToken }),
    });

    if (!msgRes.ok) {
      const errBody = await msgRes.text();
      console.error(`[send-service-message] failed: ${msgRes.status} ${errBody}`);
      return NextResponse.json({ error: "Failed to send service message", detail: msgRes.status }, { status: 500 });
    }

    const resData = await msgRes.json();

    // ドキュメント仕様: 送信ごとにトークン値が更新されるため保存する
    if (resData.notificationToken) {
      await supabaseAdmin
        .from("orders")
        .update({ service_notification_token: resData.notificationToken })
        .eq("id", orderId);
    }

    console.log(`[send-service-message] sent: orderId=${orderId} template=${templateName} remaining=${resData.remainingCount}`);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[send-service-message] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
