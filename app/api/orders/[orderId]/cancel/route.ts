import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Resend } from "resend";
import { payjpRefund, payjpIsChargeRefunded } from "@/lib/payjp";
import { resolveStoreLineConfig, resolveChannelByLiffId } from "@/lib/line";
import { releaseCouponForCancelledOrder } from "@/lib/coupons";
import { revertOrderPoints } from "@/lib/order-points";
import { getAuthenticatedAppUser, isGuestUserId, isStoreStaff } from "@/lib/api-auth";
import { ORDER_ACCESS_HEADER, isValidOrderAccessKey } from "@/lib/signed-value";

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
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const { orderId } = params
  if (!orderId) {
    return NextResponse.json({ error: "orderId required" }, { status: 400 })
  }

  const appUser = await getAuthenticatedAppUser(req, supabaseAdmin)

  const { data: order, error: fetchErr } = await supabaseAdmin
    .from("orders")
    .select(`
      id, order_no, order_status, payment_status, cancel_deadline_at, payjp_charge_id,
      customer_id, discount_amount, store_id, order_type, pickup_date, pickup_time,
      total_amount, service_notification_token, source_liff_id,
      created_at, guest_email, customer_name_snapshot,
      stores(name, address, phone),
      users!orders_customer_id_fkey(name, email),
      order_items(product_name_snapshot, quantity, subtotal, order_item_options(option_group_name_snapshot, option_item_name_snapshot, price_delta, quantity, free_quantity))
    `)
    .eq("id", orderId)
    .maybeSingle() as any

  if (fetchErr || !order) {
    return NextResponse.json({ error: "注文が見つかりませんでした" }, { status: 404 })
  }

  // 注文の本人、またはその店舗のスタッフのみキャンセルできる。
  // ログインセッションが無い場合は、LINE未ログインのECゲスト注文（customer_idが
  // auth_user_idを持たない行）に限って許可する（本物のアカウントの注文を
  // 第三者が勝手にキャンセルすることは防ぐ）
  // 注文確認メールのリンク（その注文専用の鍵付き）から開いた場合は、ログインなしでも本人として扱う
  if (isValidOrderAccessKey(req.headers.get(ORDER_ACCESS_HEADER), orderId)) {
    // 鍵はその注文のためだけに発行され、メールの受信者（注文者）しか知らない
  } else if (appUser) {
    const isOwner = order.customer_id === appUser.id
    const isStaff = await isStoreStaff(supabaseAdmin, appUser.id, order.store_id)
    if (!isOwner && !isStaff) {
      return NextResponse.json({ error: "権限がありません" }, { status: 403 })
    }
  } else if (!order.customer_id || !(await isGuestUserId(supabaseAdmin, order.customer_id))) {
    return NextResponse.json({ error: "ログインが必要です" }, { status: 401 })
  }

  if (UNCANCELLABLE_STATUSES.includes(order.order_status)) {
    return NextResponse.json({ error: "この注文はキャンセルできません" }, { status: 400 })
  }

  if (order.cancel_deadline_at && new Date(order.cancel_deadline_at) < new Date()) {
    return NextResponse.json({ error: "キャンセル期限を過ぎています" }, { status: 400 })
  }

  // 返金・ポイント返還・クーポン解放より先に、読み取った時点のステータスのままである場合に限って
  // cancelled へ条件付き更新し、このリクエストがキャンセル処理の権利を確保する。
  // 同時に複数のキャンセルが来ても1件しか更新できないため、返金やポイント返還が二重に行われない。
  const previousStatus: string = order.order_status
  const { data: claimed, error: claimErr } = await supabaseAdmin
    .from("orders")
    .update({ order_status: "cancelled" })
    .eq("id", orderId)
    .eq("order_status", previousStatus)
    .select("id")
    .maybeSingle()

  if (claimErr) {
    console.error("[cancel] DB 更新エラー:", claimErr)
    return NextResponse.json({ error: "キャンセル処理に失敗しました" }, { status: 500 })
  }
  if (!claimed) {
    // 他のリクエストが先にステータスを変更した（キャンセル済み等）
    return NextResponse.json({ error: "この注文はキャンセルできません" }, { status: 400 })
  }

  // クレジットカード決済済みの場合は PAY.JP で返金
  if (order.payment_status === "paid" && order.payjp_charge_id) {
    // 返金APIが失敗・通信エラーになった場合でも、実際には返金済み（前回の試行で返金された等）のことがあるため確認する
    const refunded =
      (await payjpRefund(order.payjp_charge_id)) ||
      (await payjpIsChargeRefunded(order.payjp_charge_id)) === true
    if (!refunded) {
      console.error("[cancel] PAY.JP 返金エラー:", { orderId, chargeId: order.payjp_charge_id })
      // 返金できなかった場合はキャンセルを取り消し、元のステータスへ戻して再試行できるようにする
      const { error: revertErr } = await supabaseAdmin
        .from("orders")
        .update({ order_status: previousStatus })
        .eq("id", orderId)
        .eq("order_status", "cancelled")
      if (revertErr) console.error("[cancel] ステータス復元エラー:", revertErr)
      return NextResponse.json({ error: "返金処理に失敗しました。お手数ですが店舗までご連絡ください。" }, { status: 500 })
    }

    // 店舗側の一覧・レシートで「決済済み」のまま残らないよう payment_status も反映する。
    // ここで失敗しても返金・キャンセル自体は完了しているため、ログのみ残して処理を続ける
    const { error: paymentErr } = await supabaseAdmin
      .from("orders")
      .update({ payment_status: "refunded" })
      .eq("id", orderId)
    if (paymentErr) console.error("[cancel] payment_status 更新エラー（返金は完了済み）:", paymentErr)
  }

  // ポイントを戻す（利用分を返還し、この注文で付与した分を回収する）。
  // DB関数 revert_order_points が反映済みの注文に限り1回だけ処理するため、二重返還は起こらない
  if (order.customer_id) {
    const reverted = await revertOrderPoints(supabaseAdmin, orderId)
    if (!reverted) console.error(`[cancel] ポイント返還に失敗しました: orderId=${orderId}`)
  }

  // 使用済みクーポンを未使用状態へ戻す
  await releaseCouponForCancelledOrder(orderId, supabaseAdmin)

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
  let resolvedByLiff = sourceLiffId ? await resolveChannelByLiffId(sourceLiffId, supabaseAdmin) : null
  if (!resolvedByLiff && sourceLiffId && sourceLiffId === process.env.NEXT_PUBLIC_LIFF_ID) {
    // patimoba 公開LIFFはLINE Loginチャネル配下のためstatelessトークン不可。
    // Messaging APIチャネルのアクセストークンを直接使用する。
    resolvedByLiff = {
      liffId: sourceLiffId,
      channelAccessToken: process.env.LINE_CHANNEL_ACCESS_TOKEN ?? null,
      channelSecret: null,
    }
  }
  const lineConfig = resolvedByLiff ?? await resolveStoreLineConfig(order.store_id, supabaseAdmin)
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
      const chargeableQty = Math.max(0, qty - (opt.free_quantity ?? 0))
      const totalPrice = group === "ろうそく" ? price * chargeableQty : price
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
  const isPublicLiff = liffId === process.env.NEXT_PUBLIC_LIFF_ID
  const liffBase = (liffId && !isPublicLiff) ? `https://liff.line.me/${liffId}` : "https://order.patisseriemobile.com"
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
