import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveStoreLineConfig, resolveChannelByLiffId } from "@/lib/line";

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
    const { orderId, storeId: bodyStoreId, liffAccessToken, sourceLiffId } = await req.json();
    if (!liffAccessToken) {
      return NextResponse.json({ error: "liffAccessToken required" }, { status: 400 });
    }

    let resolvedStoreId: string;

    if (orderId) {
      const { data: order } = await supabaseAdmin
        .from("orders")
        .select("store_id")
        .eq("id", orderId)
        .maybeSingle() as any;
      if (!order?.store_id) {
        return NextResponse.json({ error: "Store not found" }, { status: 404 });
      }
      resolvedStoreId = order.store_id;
    } else if (bodyStoreId) {
      resolvedStoreId = bodyStoreId;
    } else {
      return NextResponse.json({ error: "orderId or storeId required" }, { status: 400 });
    }

    // sourceLiffId（一覧LIFF）が指定された場合はそのチャネル設定を優先する
    let resolvedByLiff = sourceLiffId ? await resolveChannelByLiffId(sourceLiffId, supabaseAdmin) : null;
    // DBに登録されていない patimoba 公開LIFFの場合は env var から取得
    if (!resolvedByLiff && sourceLiffId && sourceLiffId === process.env.NEXT_PUBLIC_LIFF_ID) {
      // patimoba 公開LIFFはLINE Loginチャネル配下のためstatelessトークン不可。
      // Messaging APIチャネルのアクセストークンを直接使用する。
      resolvedByLiff = {
        liffId: sourceLiffId,
        channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? null,
        channelSecret: null,
      };
    }
    const lineConfig = resolvedByLiff ?? await resolveStoreLineConfig(resolvedStoreId, supabaseAdmin);
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

    if (orderId) {
      await supabaseAdmin
        .from("orders")
        .update({ service_notification_token: notificationToken, source_liff_id: liffId || null })
        .eq("id", orderId);
      console.log(`[issue-notification-token] issued: orderId=${orderId}`);
    } else {
      console.log("[issue-notification-token] issued (pre-3DS, no orderId)");
    }

    return NextResponse.json({ success: true, notificationToken });
  } catch (e) {
    console.error("[issue-notification-token] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
