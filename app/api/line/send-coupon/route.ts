import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { resolveStoreLineConfig } from "@/lib/line";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function POST(req: NextRequest) {
  try {
    const { couponId, storeId, userIds } = await req.json();
    if (!couponId || !storeId || !Array.isArray(userIds) || userIds.length === 0) {
      return NextResponse.json({ error: "couponId, storeId, userIds required" }, { status: 400 });
    }

    const [{ data: coupon }, lineConfig, { data: users }] = await Promise.all([
      supabaseAdmin
        .from("coupons")
        .select("id, title, code, discount_type, discount_value, expires_at, store_id")
        .eq("id", couponId)
        .eq("store_id", storeId)
        .maybeSingle(),
      resolveStoreLineConfig(storeId, supabaseAdmin),
      supabaseAdmin
        .from("users")
        .select("id, name, line_user_id")
        .in("id", userIds),
    ]);

    if (!coupon) {
      return NextResponse.json({ error: "Coupon not found" }, { status: 404 });
    }
    if (!lineConfig.channelAccessToken) {
      return NextResponse.json({ error: "LINE channel not configured" }, { status: 400 });
    }

    const discountLabel =
      coupon.discount_type === "percentage"
        ? `${coupon.discount_value}% OFF`
        : `${coupon.discount_value.toLocaleString()}円引き`;

    const expiryLabel = coupon.expires_at
      ? new Date(coupon.expires_at).toLocaleDateString("ja-JP", {
          year: "numeric",
          month: "long",
          day: "numeric",
        })
      : "なし";

    const results = await Promise.allSettled(
      (users ?? [])
        .filter((u) => !!u.line_user_id)
        .map(async (u) => {
          const name = u.name ? `${u.name} 様` : "お客様";
          const message =
            `【クーポンのお知らせ🎁】\n\n${name}\n\n` +
            `「${coupon.title}」をお届けします✨\n\n` +
            `クーポンコード：${coupon.code}\n` +
            `割引内容：${discountLabel}\n` +
            `有効期限：${expiryLabel}\n\n` +
            `ご注文の際にスタッフへお伝えください🎂`;

          const res = await fetch("https://api.line.me/v2/bot/message/push", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${lineConfig.channelAccessToken}`,
            },
            body: JSON.stringify({
              to: u.line_user_id,
              messages: [{ type: "text", text: message }],
            }),
          });

          if (!res.ok) {
            const body = await res.text();
            throw new Error(`LINE push failed for user ${u.id}: ${body}`);
          }

          return u.id;
        })
    );

    const sentUserIds = results
      .filter((r): r is PromiseFulfilledResult<string> => r.status === "fulfilled")
      .map((r) => r.value);

    if (sentUserIds.length > 0) {
      await supabaseAdmin.from("coupon_deliveries").insert(
        sentUserIds.map((userId) => ({ coupon_id: couponId, user_id: userId }))
      );
    }

    const failed = results.filter((r) => r.status === "rejected").length;
    const skipped = (users ?? []).filter((u) => !u.line_user_id).length;

    return NextResponse.json({ sent: sentUserIds.length, failed, skipped });
  } catch (e) {
    console.error("[send-coupon] error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
