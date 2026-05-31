import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

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
        id, order_type, pickup_date, pickup_time, customer_name_snapshot,
        service_notification_token,
        stores(name, liff_id, line_channel_access_token, line_channel_secret),
        users!orders_customer_id_fkey(name)
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
    const customerName: string = order.customer_name_snapshot || order.users?.name || "お客様";
    const isEc = order.order_type === "ec";

    const liffId: string = store?.liff_id ?? "";
    const channelSecret: string = store?.line_channel_secret ?? "";
    let channelAccessToken: string;

    if (liffId && channelSecret) {
      const channelId = liffId.split("-")[0];
      channelAccessToken = await getStatelessToken(channelId, channelSecret);
    } else {
      channelAccessToken = store?.line_channel_access_token ?? "";
    }

    if (!channelAccessToken) {
      return NextResponse.json({ error: "No channel access token available" }, { status: 500 });
    }

    const templateName = isEc
      ? (process.env.LINE_SERVICE_TEMPLATE_EC ?? "order_confirmed_ec_ja")
      : (process.env.LINE_SERVICE_TEMPLATE_TAKEOUT ?? "order_request_d_o_ja");

    const params: Record<string, string> = {
      customer_name: customerName,
      store_name: storeName,
    };

    if (!isEc) {
      if (order.pickup_date) {
        params.pickup_date = new Date(order.pickup_date).toLocaleDateString("ja-JP", {
          year: "numeric", month: "long", day: "numeric", weekday: "short",
        });
      }
      if (order.pickup_time) {
        params.pickup_time = order.pickup_time.slice(0, 5);
      }
    }

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
