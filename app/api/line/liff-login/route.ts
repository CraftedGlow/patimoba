import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"
import { findOrCreateLineUser } from "@/lib/line-user"
import { isWithinValidPeriod, formatDiscount } from "@/lib/coupons"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const idToken = body?.idToken

  if (!idToken) {
    return NextResponse.json({ error: "id_token_required" }, { status: 400 })
  }

  // liffId の `-` より前がチャンネルID。未送信時は環境変数にフォールバック
  const channelId = body?.liffId
    ? String(body.liffId).split("-")[0]
    : process.env.LINE_LOGIN_CHANNEL_ID
  if (!channelId) {
    return NextResponse.json({ error: "server_misconfigured", detail: "channel_id missing" }, { status: 500 })
  }

  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY
  if (!serviceRoleKey) {
    return NextResponse.json({ error: "server_misconfigured", detail: "SUPABASE_SERVICE_ROLE_KEY missing" }, { status: 500 })
  }

  // LINE ID トークン検証
  const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  })
  const verified = await verifyRes.json()
  if (!verifyRes.ok || !verified.sub) {
    return NextResponse.json({ error: "invalid_token" }, { status: 401 })
  }

  const lineUserId: string = verified.sub
  // liff.getProfile() の値を優先（IDトークンの name クレームはキャッシュされる場合がある）
  const lineName: string = body?.lineName || verified.name || ""
  const avatarUrl: string | null = body?.avatarUrl || verified.picture || null
  const liffId: string | null = body?.liffId ? String(body.liffId) : null
  console.log(`[LIFF Login] 受信プロフィール: lineUserId=${lineUserId}, liffId=${liffId ?? "(none)"}, body.lineName=${body?.lineName ?? "(none)"}, verified.name=${verified.name ?? "(none)"}, resolved lineName=${lineName}`)

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  )

  const { user, error: findOrCreateError } = await findOrCreateLineUser(lineUserId, liffId, lineName, avatarUrl, supabase)
  if (!user) {
    console.error("[LIFF Login] findOrCreateLineUser 失敗:", findOrCreateError)
    return NextResponse.json({ error: "user_create_failed", detail: findOrCreateError }, { status: 500 })
  }
  console.log(`[LIFF Login] ユーザー確定: userId=${user.id}`)

  // ── OTP 生成してクライアント側で Supabase セッションを確立 ───────────────
  const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(user.auth_user_id!)
  if (authUserError || !authUserData.user?.email) {
    console.error("[LIFF Login] auth ユーザー取得失敗:", authUserError)
    return NextResponse.json({ error: "auth_user_not_found", detail: authUserError?.message }, { status: 500 })
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: authUserData.user.email,
  })
  if (linkError || !linkData.properties?.email_otp) {
    console.error("[LIFF Login] OTP 生成失敗:", linkError)
    return NextResponse.json({ error: "otp_generation_failed", detail: linkError?.message }, { status: 500 })
  }

  console.log(`[LIFF Login] ログイン成功: userId=${user.id}`)

  // クーポントークンが同梱されている場合はここで獲得まで済ませる
  // （クライアント側の別リクエストを待たず、往復を1回減らして LINE 側の
  // リロード競合に負けにくくする）
  let coupon: { title: string; discountLabel: string; storeId: string } | undefined
  const couponToken: string | undefined = body?.couponToken
  if (couponToken) {
    const { data: couponRow } = await supabase
      .from("coupons")
      .select("id, store_id, title, discount_type, discount_value, is_active, valid_from, expires_at")
      .eq("share_token", couponToken)
      .maybeSingle()

    if (couponRow && couponRow.is_active && isWithinValidPeriod(couponRow, new Date())) {
      const { error: claimError } = await supabase
        .from("coupon_deliveries")
        .insert({ coupon_id: couponRow.id, user_id: user.id, claim_method: "link" })

      if (!claimError || claimError.code === "23505") {
        coupon = { title: couponRow.title, discountLabel: formatDiscount(couponRow as any), storeId: couponRow.store_id }
      } else {
        console.error("[LIFF Login] クーポン獲得失敗:", claimError)
      }
    }
  }

  return NextResponse.json({
    user,
    otp: { email: authUserData.user.email, token: linkData.properties.email_otp },
    coupon,
  })
}
