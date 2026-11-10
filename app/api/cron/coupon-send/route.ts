import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendCouponPush, resolveStoreAudience, resolveOrderedCustomerIds } from "@/lib/coupons";

// processing のまま、この時間を過ぎた配信予約は中断されたものとみなして再開する（関数の最大実行時間より十分長く）
const STALE_PROCESSING_MS = 30 * 60 * 1000;

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

function pickRecipients(idsNewestFirst: string[], limit: number, mode: "random" | "newest") {
  if (mode === "newest") return idsNewestFirst.slice(0, limit);
  const shuffled = [...idsNewestFirst].sort(() => Math.random() - 0.5);
  return shuffled.slice(0, limit);
}

async function processSend(send: any) {
  try {
    let userIds: string[];
    if (send.target_type === "selected") {
      userIds = send.target_user_ids ?? [];
    } else {
      // resolveStoreAudience は created_at 降順で返るため、フィルタ後もその順序を維持する
      const [audienceResult, orderedIds] = await Promise.all([
        resolveStoreAudience(send.store_id, supabaseAdmin),
        send.filter_ordered_only ? resolveOrderedCustomerIds(send.store_id, supabaseAdmin) : Promise.resolve(null),
      ]);
      let audience = audienceResult;
      if (orderedIds) {
        audience = audience.filter((a) => orderedIds.has(a.id));
      }
      if (send.filter_gender) {
        audience = audience.filter((a) => a.gender === send.filter_gender);
      }

      const idsNewestFirst = audience.map((a) => a.id);
      userIds =
        send.recipient_limit && send.selection_mode
          ? pickRecipients(idsNewestFirst, send.recipient_limit, send.selection_mode as "random" | "newest")
          : idsNewestFirst;
    }

    if (userIds.length === 0) {
      await supabaseAdmin
        .from("coupon_sends")
        .update({ status: "sent", result_sent: 0, result_failed: 0, result_skipped: 0, sent_at: new Date().toISOString() })
        .eq("id", send.id);
      return;
    }

    const result = await sendCouponPush(send.coupon_id, send.store_id, userIds, "push", supabaseAdmin);
    if (result.error) {
      console.error("[coupon-send cron] sendCouponPush error for send:", send.id, result.error);
      await supabaseAdmin.from("coupon_sends").update({ status: "failed" }).eq("id", send.id);
      return;
    }
    await supabaseAdmin
      .from("coupon_sends")
      .update({
        status: "sent",
        result_sent: result.sent,
        result_failed: result.failed,
        result_skipped: result.skipped,
        sent_at: new Date().toISOString(),
      })
      .eq("id", send.id);
  } catch (e) {
    console.error("[coupon-send cron] failed for send:", send.id, e);
    await supabaseAdmin.from("coupon_sends").update({ status: "failed" }).eq("id", send.id);
  }
}

export async function GET(req: NextRequest) {
  // CRON_SECRET 未設定時に "Bearer undefined" で通ってしまわないよう、未設定なら常に拒否する
  const cronSecret = process.env.CRON_SECRET;
  if (!cronSecret || req.headers.get("authorization") !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  // processing のまま一定時間経過したもの（前回実行がタイムアウト等で中断された）も再開対象にする
  const staleBefore = new Date(now.getTime() - STALE_PROCESSING_MS).toISOString();

  const { data: pendingSends } = await supabaseAdmin
    .from("coupon_sends")
    .select("id, status, processing_started_at")
    .or(`status.eq.pending,and(status.eq.processing,processing_started_at.lt.${staleBefore})`)
    .lte("scheduled_at", now.toISOString());

  if (!pendingSends || pendingSends.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  // cron の多重起動・前回実行の長引きで同じ配信予約を二重に処理しないよう、
  // 読み取った時点の状態のままである場合に限る条件付き更新で、1件ずつ確保できたものだけを処理する。
  // 再開時に既に配布済みのユーザーは sendCouponPush 側で配布記録の一意制約によりスキップされる
  const claimed: any[] = [];
  for (const row of pendingSends) {
    let claim = supabaseAdmin
      .from("coupon_sends")
      .update({ status: "processing", processing_started_at: now.toISOString() })
      .eq("id", row.id)
      .eq("status", row.status);
    claim = row.processing_started_at
      ? claim.eq("processing_started_at", row.processing_started_at)
      : claim.is("processing_started_at", null);
    const { data, error } = await claim.select("*").maybeSingle();
    if (error) {
      console.error("[coupon-send cron] claim failed for send:", row.id, error);
      continue;
    }
    if (data) claimed.push(data);
  }

  await Promise.allSettled(claimed.map(processSend));

  return NextResponse.json({ processed: claimed.length });
}
