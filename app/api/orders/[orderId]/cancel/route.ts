import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { payjpPost } from "@/lib/payjp";
import { resolveStoreLineConfig, resolveChannelByLiffId } from "@/lib/line";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM_EMAIL = process.env.RESEND_FROM_EMAIL ?? "noreply@example.com";

const UNCANCELLABLE_STATUSES = ["cancelled", "completed"]

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

export async function POST(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const { orderId } = params
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 })
  }

  const { data: order, error: fetchErr } = await supabaseAdmin
    .from("orders")
    .select(`
      id, order_no, order_status, payment_status, cancel_deadline_at, payjp_charge_id,
      customer_id, discount_amount, store_id, order_type, pickup_date, pickup_time,
      total_amount, service_notification_token, source_liff_id,
      created_at, guest_email, customer_name_snapshot,
      stores(name, address, phone),
      users!orders_customer_id_fkey(name, email),
      order_items(product_name_snapshot, quantity, subtotal, order_item_options(option_group_name_snapshot, option_item_name_snapshot, price_delta, quantity))
    `)
    .eq("id", orderId)
    .maybeSingle() as any

  if (fetchErr || !order) {
    return NextResponse.json({ error: "注文が見つかりませんでした" }, { status: 404 })
  }

  if (UNCANCELLABLE_STATUSES.includes(order.order_status)) {
    return NextResponse.json({ error: "この注文はキャンセルできません" }, { status: 400 })
  }

  if (order.cancel_deadline_at && new Date(order.cancel_deadline_at) < new Date()) {
    return NextResponse.json({ error: "キャンセル期限を過ぎています" }, { status: 400 })
  }

  // クレジットカード決済済みの場合は PAY.JP で返金
  let refunded = false
  if (order.payment_status === "paid" && order.payjp_charge_id) {
    const refundRes = await payjpPost(`/charges/${order.payjp_charge_id}/refund`, {})
    const refundData = await refundRes.json()
    if (!refundRes.ok) {
      console.error("[cancel] PAY.JP 返金エラー:", refundData)
      return NextResponse.json({ error: "返金処理に失敗しました。お手数ですが店舗までご連絡ください。" }, { status: 500 })
    }
    refunded = true
  }

  // 使用ポイントを返還
  const discountAmount = Number(order.discount_amount ?? 0)
  if (discountAmount > 0 && order.customer_id) {
    const { data: user } = await supabaseAdmin
      .from("users")
      .select("points")
      .eq("id", order.customer_id)
      .maybeSingle()

    if (user) {
      await supabaseAdmin
        .from("users")
        .update({ points: (Number(user.points) ?? 0) + discountAmount })
        .eq("id", order.customer_id)
    }
  }

  // order_status を cancelled に更新（ステータス確認済みのため単純 UPDATE）
  // 返金済みの場合は payment_status も反映し、店舗側の一覧・レシートで「決済済み」のまま残らないようにする
  const { error: updateErr } = await supabaseAdmin
    .from("orders")
    .update({ order_status: "cancelled", ...(refunded ? { payment_status: "refunded" } : {}) })
    .eq("id", orderId)

  if (updateErr) {
    console.error("[cancel] DB 更新エラー:", updateErr)
    return NextResponse.json({ error: "キャンセル処理に失敗しました" }, { status: 500 })
  }

  // キャンセル通知メッセージ送信（レスポンス前に完了させる）
  // LINEサービスメッセージを優先し、送れなかった場合（ECゲスト等）はメールで通知する
  let lineSent = false
  try {
    lineSent = await sendCancelNotification(orderId, order)
  } catch (e) {
    console.error("[cancel] サービスメッセージ送信エラー:", e)
  }
  if (!lineSent) {
    try {
      await sendCancelEmail(order)
    } catch (e) {
      console.error("[cancel] キャンセルメール送信エラー:", e)
    }
  }

  return NextResponse.json({ success: true })
}

async function sendCancelEmail(order: any): Promise<void> {
  const email: string | null = order.users?.email ?? order.guest_email ?? null
  if (!email) {
    console.warn(`[cancel] メール送信先なし（通知スキップ）: orderId=${order.id}`)
    return
  }

  const storeName: string = order.stores?.name ?? ""
  const storePhone: string = order.stores?.phone ?? ""
  const rawName: string = order.customer_name_snapshot || order.users?.name || ""
  const nameLabel = rawName ? `${rawName} 様` : "お客様"

  const items: Array<{ product_name_snapshot: string; quantity: number }> = order.order_items || []
  const itemsText = items.map((i) => `・${i.product_name_snapshot} ×${i.quantity}`).join("\n")

  const totalAmount = Number(order.total_amount ?? 0).toLocaleString()
  const orderDate = new Date(order.created_at).toLocaleString("ja-JP", {
    timeZone: "Asia/Tokyo", year: "numeric", month: "long", day: "numeric", hour: "2-digit", minute: "2-digit",
  })

  const refundNote =
    order.payment_status === "paid" && order.payjp_charge_id
      ? "\nクレジットカードでお支払いいただいた分は返金処理を行いました。3〜10営業日程度でカード会社を通じて返金されます。\n"
      : ""

  const body = `${nameLabel}

以下のご注文をキャンセルいたしました。

-------------------------------
注文店舗：${storeName}
店舗の電話番号：${storePhone}
注文日時：${orderDate}
-------------------------------
【ご注文商品】
${itemsText}
-------------------------------
合計金額（税込）：${totalAmount}円
${refundNote}-------------------------------

ご不明な点がございましたら、下記までご連絡ください。
${storeName}
TEL：${storePhone}`

  const { error } = await resend.emails.send({
    from: `${storeName || "パティモバ"} <${FROM_EMAIL}>`,
    to: email,
    subject: `【${storeName}】ご注文キャンセルのお知らせ`,
    text: body,
  })

  if (error) {
    console.error("[cancel] Resend send error:", error)
  }
}

async function sendCancelNotification(orderId: string, order: any): Promise<boolean> {
  const notificationToken: string | null = order.service_notification_token
  if (!notificationToken) {
    console.warn(`[cancel] notification token なし（通知スキップ）: orderId=${orderId}`)
    return false
  }

  const sourceLiffId: string | null = order.source_liff_id ?? null
  const lineConfig = sourceLiffId
    ? (await resolveChannelByLiffId(sourceLiffId, supabaseAdmin)) ?? await resolveStoreLineConfig(order.store_id, supabaseAdmin)
    : await resolveStoreLineConfig(order.store_id, supabaseAdmin)
  const liffId: string = lineConfig.liffId ?? ""
  const channelSecret: string = lineConfig.channelSecret ?? ""
  let channelAccessToken: string

  if (liffId && channelSecret) {
    channelAccessToken = await getStatelessToken(liffId.split("-")[0], channelSecret)
  } else {
    channelAccessToken = lineConfig.channelAccessToken ?? ""
  }

  if (!channelAccessToken) {
    console.warn(`[cancel] channel access token なし: orderId=${orderId}`)
    return false
  }

  // 受取日時
  let dateStr = ""
  if (order.pickup_date) {
    const d = new Date(order.pickup_date)
    dateStr = `${d.getFullYear()}/${d.getMonth() + 1}/${d.getDate()}`
    if (order.pickup_time) dateStr += ` ${order.pickup_time.slice(0, 5)}`
  } else {
    const now = new Date()
    dateStr = `${now.getFullYear()}/${now.getMonth() + 1}/${now.getDate()}`
  }

  // 注文商品詳細（注文完了メッセージと同様のフォーマット）
  const items: Array<any> = order.order_items || []
  const orderDetail = items.map((item: any) => {
    const allOpts = (item.order_item_options ?? []).filter(
      (o: any) => o.option_group_name_snapshot !== "アレルギー"
    )
    const plateOpt = allOpts.find((o: any) => o.option_group_name_snapshot === "メッセージプレート")
    const messageOpt = allOpts.find((o: any) => o.option_group_name_snapshot === "メッセージ")
    const plateMsgOpts = allOpts.filter((o: any) => o.option_group_name_snapshot === "プレートメッセージ")
    const opts = allOpts.filter((o: any) =>
      o.option_group_name_snapshot !== "メッセージプレート" &&
      o.option_group_name_snapshot !== "メッセージ" &&
      o.option_group_name_snapshot !== "プレートメッセージ"
    )

    const lines: string[] = [`${item.product_name_snapshot} ×${item.quantity}`]
    for (const opt of opts) {
      const group = opt.option_group_name_snapshot ?? ""
      const name = opt.option_item_name_snapshot ?? ""
      const price = opt.price_delta ?? 0
      const qty = opt.quantity ?? 1
      const totalPrice = group === "ろうそく" ? price * qty : price
      let label: string
      if (group === "サイズ") label = `  サイズ：${name}`
      else if (group === "ろうそく") label = `  ろうそく：${name}${qty > 1 ? `×${qty}` : ""}`
      else label = `  ${name}`
      lines.push(totalPrice > 0 ? `${label}　¥${totalPrice.toLocaleString()}` : label)
    }
    if (plateOpt || messageOpt) {
      const plate = plateOpt?.option_item_name_snapshot ?? ""
      const msg = messageOpt?.option_item_name_snapshot ?? ""
      lines.push(`  メッセージ：${plate}${msg ? `「${msg}」` : ""}`)
    }
    for (const pm of plateMsgOpts) {
      lines.push(`  ${pm.option_item_name_snapshot ?? ""}`)
    }
    return lines.join("\n")
  }).join("\n")

  const truncatedDetail = orderDetail.length > 45 ? orderDetail.slice(0, 45) + "..." : (orderDetail || "（明細なし）")
  const sumStr = `¥${Number(order.total_amount || 0).toLocaleString()}（税込）`
  const liffBase = liffId ? `https://liff.line.me/${liffId}` : "https://order.patisseriemobile.com"
  const orderDetailUrl = `${liffBase}/customer/orders/${orderId}`
  const templateName = process.env.LINE_SERVICE_TEMPLATE_CANCEL ?? "user_cancle_d_ja"

  const msgParams: Record<string, string> = {
    date: dateStr,
    detail: truncatedDetail,
    shop_name: order.stores?.name || "店舗名",
    address: order.stores?.address || "住所未設定",
    sum: sumStr,
    cancel_sum: "¥0",
    btn1_url: orderDetailUrl,
  }

  const msgRes = await fetch("https://api.line.me/message/v3/notifier/send?target=service", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${channelAccessToken}`,
    },
    body: JSON.stringify({ templateName, params: msgParams, notificationToken }),
  })

  if (!msgRes.ok) {
    const errBody = await msgRes.text()
    throw new Error(`LINE API error: ${msgRes.status} ${errBody}`)
  }

  const resData = await msgRes.json()
  if (resData.notificationToken) {
    await supabaseAdmin
      .from("orders")
      .update({ service_notification_token: resData.notificationToken })
      .eq("id", orderId)
  }

  console.log(`[cancel] service message sent: orderId=${orderId}`)
  return true
}
