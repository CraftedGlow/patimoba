import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendCouponPush, resolveStoreAudience, resolveOrderedCustomerIds } from "@/lib/coupons";

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
  if (req.headers.get("authorization") !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { data: pendingSends } = await supabaseAdmin
    .from("coupon_sends")
    .select("*")
    .eq("status", "pending")
    .lte("scheduled_at", new Date().toISOString());

  if (!pendingSends || pendingSends.length === 0) {
    return NextResponse.json({ processed: 0 });
  }

  await Promise.allSettled(pendingSends.map(processSend));

  return NextResponse.json({ processed: pendingSends.length });
}
