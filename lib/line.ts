import { createClient } from "@supabase/supabase-js";

export async function sendOrderLineMessage(orderId: string): Promise<void> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select(`
      *,
      stores(name, phone, address, line_channel_access_token),
      users!orders_customer_id_fkey(name, line_user_id, email),
      order_items(product_name_snapshot, quantity, unit_price)
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (orderError) {
    console.error(`[LINE] DB query error: orderId=${orderId}`, orderError);
    return;
  }
  if (!order) {
    console.warn(`[LINE] order not found: orderId=${orderId}`);
    return;
  }

  const storeName = order.stores?.name ?? "";
  const storePhone = order.stores?.phone ?? "";
  const channelAccessToken = order.stores?.line_channel_access_token ?? null;
  const lineUserId = order.users?.line_user_id ?? null;
  const email = order.users?.email ?? null;
  const customerName = order.users?.name ?? "";

  console.log(`[LINE] sending order message: orderId=${orderId} store=${storeName} lineUserId=${lineUserId ?? "none"} hasToken=${!!channelAccessToken}`);

  const itemsText = (order.order_items || [])
    .map((i: any) => `・${i.product_name_snapshot} ×${i.quantity}`)
    .join("\n");

  const pickupDate = order.pickup_date
    ? new Date(order.pickup_date).toLocaleDateString("ja-JP", {
        year: "numeric",
        month: "long",
        day: "numeric",
        weekday: "short",
      })
    : "";
  const pickupTime = order.pickup_time ? order.pickup_time.slice(0, 5) : "";
  const pickupStr = [pickupDate, pickupTime].filter(Boolean).join(" ");

  const message = `ご注文ありがとうございます！このメッセージを来店時にお見せください！

お名前: ${customerName}
店舗名: ${storeName}
来店日時: ${pickupStr}

注文商品：
${itemsText}

合計金額：${Number(order.total_amount).toLocaleString()}円

${storeName}の電話番号
${storePhone}
※キャンセル・変更の場合は記載されている電話番号にご連絡ください。
無断キャンセルの場合は料金の100%をお支払いいただきます。`;

  if (lineUserId && channelAccessToken) {
    const res = await fetch("https://api.line.me/v2/bot/message/push", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${channelAccessToken}`,
      },
      body: JSON.stringify({
        to: lineUserId,
        messages: [{ type: "text", text: message }],
      }),
    });
    if (res.ok) {
      console.log(`[LINE] push sent successfully: orderId=${orderId} lineUserId=${lineUserId}`);
    } else {
      const body = await res.text();
      console.error(`[LINE] push failed: orderId=${orderId} status=${res.status} body=${body}`);
    }
  } else if (email) {
    console.log(`[LINE] fallback to email: orderId=${orderId} email=${email} reason=${!lineUserId ? "no lineUserId" : "no channelAccessToken"}`);
  } else {
    console.warn(`[LINE] no delivery channel: orderId=${orderId} lineUserId=${lineUserId ?? "none"} hasToken=${!!channelAccessToken} email=${email ?? "none"}`);
  }
}
