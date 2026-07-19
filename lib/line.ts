import { createClient } from "@supabase/supabase-js";

export interface StoreLineConfig {
  liffId: string | null;
  channelAccessToken: string | null;
  channelSecret: string | null;
}

/**
 * LIFF ID でチャネル設定を逆引きする（一覧LIFFフローで使用）
 * 見つからない場合は null を返す
 */
export async function resolveChannelByLiffId(
  liffId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any
): Promise<StoreLineConfig | null> {
  try {
    const { data } = await supabaseAdmin
      .from("stores")
      .select("liff_id, line_channel_access_token, line_channel_secret")
      .eq("liff_id", liffId)
      .maybeSingle();
    const d = data as any;
    if (!d) return null;
    return {
      liffId: d.liff_id ?? null,
      channelAccessToken: d.line_channel_access_token ?? null,
      channelSecret: d.line_channel_secret ?? null,
    };
  } catch {
    return null;
  }
}

export async function resolveStoreLineConfig(
  storeId: string,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabaseAdmin: any
): Promise<StoreLineConfig> {
  const { data } = await supabaseAdmin
    .from("stores")
    .select("liff_id, line_channel_access_token, line_channel_secret, parent_store_id")
    .eq("id", storeId)
    .single();

  const d = data as any;
  if (!d) return { liffId: null, channelAccessToken: null, channelSecret: null };

  if (d.liff_id || d.line_channel_access_token) {
    return {
      liffId: d.liff_id ?? null,
      channelAccessToken: d.line_channel_access_token ?? null,
      channelSecret: d.line_channel_secret ?? null,
    };
  }

  if (d.parent_store_id) {
    const { data: parent } = await supabaseAdmin
      .from("stores")
      .select("liff_id, line_channel_access_token, line_channel_secret")
      .eq("id", d.parent_store_id)
      .single();
    const p = parent as any;
    return {
      liffId: p?.liff_id ?? null,
      channelAccessToken: p?.line_channel_access_token ?? null,
      channelSecret: p?.line_channel_secret ?? null,
    };
  }

  return {
    liffId: d.liff_id ?? null,
    channelAccessToken: d.line_channel_access_token ?? null,
    channelSecret: d.line_channel_secret ?? null,
  };
}

export async function sendOrderLineMessage(orderId: string): Promise<void> {
  const supabaseAdmin = createClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  );

  const { data: order, error: orderError } = await supabaseAdmin
    .from("orders")
    .select(`
      *,
      stores(name, phone, address),
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
  const { channelAccessToken } = await resolveStoreLineConfig(order.store_id, supabaseAdmin);
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
