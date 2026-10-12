import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveStoreLineConfig } from "@/lib/line";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { storeId, customerId, message } = await req.json();
    const text = typeof message === "string" ? message.trim() : "";
    if (!storeId || !customerId || !text) {
      return NextResponse.json({ error: "storeId, customerId, message required" }, { status: 400 });
    }

    const [{ data: user }, lineConfig] = await Promise.all([
      supabaseAdmin.from("users").select("line_user_id").eq("id", customerId).maybeSingle(),
      resolveStoreLineConfig(storeId, supabaseAdmin),
    ]);

    const lineUserId: string | null = (user as any)?.line_user_id ?? null;
    if (!lineUserId) {
      return NextResponse.json({ error: "no_line_user_id" }, { status: 422 });
    }
    if (!lineConfig.channelAccessToken) {
      return NextResponse.json({ error: "line_channel_not_configured" }, { status: 500 });
    }

    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${lineConfig.channelAccessToken}`,
      },
      body: JSON.stringify({ to: lineUserId, messages: [{ type: "text", text }] }),
    });

    if (!res.ok) {
      const body = await res.text();
      console.error(`[send-customer-message] failed: customerId=${customerId} status=${res.status} body=${body}`);
      // 友だち未追加/ブロック済みの場合、LINE側がこのメッセージを含むエラーを返す
      const isNotFriend = /added.*friend|blocked the bot/i.test(body);
      return NextResponse.json({ error: isNotFriend ? "not_friend" : "send_failed" }, { status: 500 });
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[send-customer-message] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
