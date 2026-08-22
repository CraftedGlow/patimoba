import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveChannelByLiffId } from "@/lib/line";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  // JST で「2週間後」の月・日を取得（cron は 0:00 UTC = 9:00 JST に実行）
  const nowJst = new Date(Date.now() + 9 * 3600 * 1000);
  const targetJst = new Date(nowJst.getTime() + 14 * 24 * 3600 * 1000);
  const tomorrowMonth = targetJst.getUTCMonth() + 1;
  const tomorrowDay = targetJst.getUTCDate();

  const { data: enabledStores } = await supabaseAdmin
    .from("stores")
    .select("liff_id")
    .eq("anniversary_reminder_enabled", true)
    .not("liff_id", "is", null);

  const enabledLiffIds = (enabledStores ?? []).map((s: { liff_id: string }) => s.liff_id);

  if (enabledLiffIds.length === 0) {
    return NextResponse.json({ sent: 0, failed: 0, total: 0 });
  }

  const { data: users, error } = await supabaseAdmin
    .from("users")
    .select("id, name, line_user_id, liff_id, anniversaries")
    .not("line_user_id", "is", null)
    .neq("anniversaries", "[]")
    .in("liff_id", enabledLiffIds);

  if (error) {
    console.error("[anniversary-reminder] DB error:", error);
    return NextResponse.json({ error: "DB error" }, { status: 500 });
  }

  type Anniversary = { label: string; date: string };

  const targets: Array<{ user: (typeof users)[number]; labels: string[] }> = [];

  for (const user of users ?? []) {
    const anniversaries = user.anniversaries as Anniversary[];
    if (!Array.isArray(anniversaries)) continue;

    const labels = anniversaries
      .filter((a) => {
        const parts = a.date?.split("-");
        if (parts?.length !== 3) return false;
        return Number(parts[1]) === tomorrowMonth && Number(parts[2]) === tomorrowDay;
      })
      .map((a) => a.label);

    if (labels.length > 0) targets.push({ user, labels });
  }

  const results = await Promise.allSettled(
    targets.map(async ({ user, labels }) => {
      if (!user.liff_id) {
        console.warn("[anniversary-reminder] no liff_id for user:", user.id);
        return;
      }

      const lineConfig = await resolveChannelByLiffId(user.liff_id, supabaseAdmin);
      if (!lineConfig?.channelAccessToken) {
        console.warn("[anniversary-reminder] no channel token for user:", user.id);
        return;
      }

      const name = user.name ? `${user.name} 様` : "お客様";
      const label = labels.join("・");
      const message = `${name}\n\n2週間後に ${label} が近づいてきました🎉\n\n特別な日にぴったりなケーキをご用意しております。\nぜひお早めにご予約・ご注文をご検討ください🎂✨`;

      const res = await fetch("https://api.line.me/v2/bot/message/push", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${lineConfig.channelAccessToken}`,
        },
        body: JSON.stringify({
          to: user.line_user_id,
          messages: [{ type: "text", text: message }],
        }),
      });

      if (!res.ok) {
        const body = await res.text();
        console.error("[anniversary-reminder] LINE push failed user:", user.id, body);
        throw new Error(`LINE push failed: ${body}`);
      }
    })
  );

  const sent = results.filter((r) => r.status === "fulfilled").length;
  const failed = results.filter((r) => r.status === "rejected").length;

  console.log(`[anniversary-reminder] sent=${sent} failed=${failed} total=${targets.length}`);
  return NextResponse.json({ sent, failed, total: targets.length });
}
