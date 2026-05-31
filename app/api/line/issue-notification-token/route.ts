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
    const { orderId, liffAccessToken } = await req.json();
    if (!orderId || !liffAccessToken) {
      return NextResponse.json({ error: "orderId and liffAccessToken required" }, { status: 400 });
    }

    const { data: order } = await supabaseAdmin
      .from("orders")
      .select("store_id, stores!inner(liff_id, line_channel_access_token, line_channel_secret)")
      .eq("id", orderId)
      .maybeSingle() as any;

    const store = order?.stores;
    if (!store) {
      return NextResponse.json({ error: "Store not found" }, { status: 404 });
    }

    const liffId: string = store.liff_id ?? "";
    const channelSecret: string = store.line_channel_secret ?? "";
    let channelAccessToken: string;

    if (liffId && channelSecret) {
      const channelId = liffId.split("-")[0];
      channelAccessToken = await getStatelessToken(channelId, channelSecret);
    } else {
      channelAccessToken = store.line_channel_access_token ?? "";
    }

    if (!channelAccessToken) {
      console.warn(`[issue-notification-token] no channel access token: orderId=${orderId}`);
      return NextResponse.json({ error: "No channel access token available" }, { status: 500 });
    }

    const tokenRes = await fetch("https://api.line.me/message/v3/notifier/token", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({ liffAccessToken }),
    });

    if (!tokenRes.ok) {
      const body = await tokenRes.text();
      console.error(`[issue-notification-token] LINE API error: ${tokenRes.status} ${body}`);
      return NextResponse.json({ error: "Failed to issue notification token" }, { status: 500 });
    }

    const { notificationToken } = await tokenRes.json();

    await supabaseAdmin
      .from("orders")
      .update({ service_notification_token: notificationToken })
      .eq("id", orderId);

    console.log(`[issue-notification-token] issued: orderId=${orderId}`);
    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[issue-notification-token] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
