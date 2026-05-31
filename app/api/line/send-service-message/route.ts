import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { orderId } = await req.json();
    if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select(`
        id, order_type, notes, pickup_date, pickup_time, customer_name_snapshot,
        service_notification_token,
        stores(name, line_channel_access_token),
        users!orders_customer_id_fkey(name, line_user_id)
      `)
      .eq("id", orderId)
      .maybeSingle() as any;

    if (!order) return NextResponse.json({ error: "Order not found" }, { status: 404 });

    const notificationToken: string | null = order.service_notification_token;
    const channelAccessToken: string = order.stores?.line_channel_access_token ?? "";
    const storeName: string = order.stores?.name ?? "";
    const customerName: string = order.customer_name_snapshot || order.users?.name || "お客様";
    const lineUserId: string | null = order.users?.line_user_id ?? null;
    const isEc = order.order_type === "ec";

    // サービスメッセージ送信（LINEミニアプリ サービスメッセージAPI）
    // ※ チャネルアクセストークンはステートレスまたは短期間トークンが必要
    // ※ templateName は LINE Mini App 設定画面で事前登録が必要
    if (notificationToken && channelAccessToken) {
      const templateName = isEc
        ? (process.env.LINE_SERVICE_TEMPLATE_EC ?? "order_shipped_ja")
        : (process.env.LINE_SERVICE_TEMPLATE_TAKEOUT ?? "order_ready_ja");

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

      if (msgRes.ok) {
        console.log(`[send-service-message] service message sent: orderId=${orderId} template=${templateName}`);
        return NextResponse.json({ success: true, method: "service" });
      }

      const errBody = await msgRes.text();
      console.warn(`[send-service-message] service message failed (${msgRes.status}), falling back: ${errBody}`);
    }

    // フォールバック: プッシュメッセージ（テイクアウトのみ、ECは send-ship-notification が別途送信）
    if (!isEc && lineUserId && channelAccessToken) {
      const pickupDate = order.pickup_date
        ? new Date(order.pickup_date).toLocaleDateString("ja-JP", {
            year: "numeric", month: "long", day: "numeric", weekday: "short",
          })
        : "";
      const pickupTime = order.pickup_time ? order.pickup_time.slice(0, 5) : "";
      const pickupStr = [pickupDate, pickupTime].filter(Boolean).join(" ");

      const lines = [
        `🎂 ご注文の準備が整いました！`,
        ``,
        `${customerName} 様`,
        ``,
        `${storeName}でのご注文が準備完了しました。`,
        `お気をつけてご来店ください🙏`,
      ];
      if (pickupStr) lines.push(``, `受取日時: ${pickupStr}`);
      lines.push(``, `このメッセージを店頭でお見せください。`);

      const pushRes = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${channelAccessToken}`,
        },
        body: JSON.stringify({
          to: lineUserId,
          messages: [{ type: "text", text: lines.join("\n") }],
        }),
      });

      if (pushRes.ok) {
        console.log(`[send-service-message] push sent: orderId=${orderId}`);
        return NextResponse.json({ success: true, method: "push" });
      }

      const pushErr = await pushRes.text();
      console.error(`[send-service-message] push failed: ${pushRes.status} ${pushErr}`);
    }

    console.warn(`[send-service-message] no delivery channel: orderId=${orderId}`);
    return NextResponse.json({ success: false, message: "no delivery channel" });
  } catch (e) {
    console.error("[send-service-message] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
