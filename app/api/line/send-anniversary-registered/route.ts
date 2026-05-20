import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { userId, storeId } = await req.json();
    if (!userId) return NextResponse.json({ error: "userId required" }, { status: 400 });

    const [{ data: user }, { data: store }] = await Promise.all([
      supabaseAdmin.from("users").select("name, line_user_id").eq("id", userId).maybeSingle(),
      storeId
        ? supabaseAdmin.from("stores").select("line_channel_access_token").eq("id", storeId).maybeSingle()
        : Promise.resolve({ data: null }),
    ]);

    if (!user?.line_user_id) return NextResponse.json({ success: true, sent: false });

    const channelAccessToken =
      (store as any)?.line_channel_access_token ?? process.env.LINE_CHANNEL_ACCESS_TOKEN;

    if (!channelAccessToken) return NextResponse.json({ success: true, sent: false });

    const name = user.name ? `${user.name} 様` : "お客様";
    const message = `🎂 記念日登録ありがとうございます！\n\n${name}\n\nご登録いただいた記念日に合わせて、特別なご提案をお届けします✨\n\nお誕生日や大切な記念日に、ぴったりなケーキをご用意してお待ちしております🍰`;

    await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: user.line_user_id,
        messages: [{ type: "text", text: message }],
      }),
    });

    return NextResponse.json({ success: true, sent: true });
  } catch (e) {
    console.error("send-anniversary-registered error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
