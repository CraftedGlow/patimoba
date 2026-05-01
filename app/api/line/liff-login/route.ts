import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

export async function POST(request: NextRequest) {
  console.log("[LIFF Login] リクエスト受信")

  const body = await request.json().catch(() => null)
  const idToken = body?.idToken

  if (!idToken) {
    console.warn("[LIFF Login] idToken なし")
    return NextResponse.json({ error: "id_token_required" }, { status: 400 })
  }

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID
  if (!channelId) {
    console.error("[LIFF Login] LINE_LOGIN_CHANNEL_ID が未設定")
    return NextResponse.json({ error: "server_misconfigured" }, { status: 500 })
  }

  // IDトークンをLINEで検証しユーザーIDを取得
  console.log("[LIFF Login] IDトークン検証中...")
  const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  })

  const verified = await verifyRes.json()
  if (!verifyRes.ok || !verified.sub) {
    console.error("[LIFF Login] IDトークン検証失敗:", verified)
    return NextResponse.json({ error: "invalid_token" }, { status: 401 })
  }

  const lineUserId: string = verified.sub
  console.log(`[LIFF Login] 検証OK: lineUserId=${lineUserId}`)

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  console.log("[LIFF Login] users テーブル照合中...")
  const { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("line_user_id", lineUserId)
    .maybeSingle()

  if (!user) {
    console.warn(`[LIFF Login] ユーザー未登録: lineUserId=${lineUserId} → 登録画面へ`)
    const pendingData = JSON.stringify({
      lineUserId,
      lineName: verified.name ?? "",
      avatarUrl: verified.picture ?? null,
    })
    const res = NextResponse.json({ action: "register" }, { status: 200 })
    res.cookies.set("line_pending_user", pendingData, {
      httpOnly: true,
      maxAge: 300,
      path: "/",
      sameSite: "lax",
    })
    return res
  }

  console.log(`[LIFF Login] ユーザー発見: userId=${user.id}, auth_user_id=${user.auth_user_id ?? "未設定"}`)

  if (!user.auth_user_id) {
    console.warn(`[LIFF Login] auth_user_id 未設定: userId=${user.id} → 登録画面へ`)
    return NextResponse.json({ action: "signup", userId: user.id }, { status: 200 })
  }

  // auth.users からメールアドレスを取得してマジックリンク OTP を生成
  const { data: authUserData, error: authUserError } = await supabase.auth.admin.getUserById(user.auth_user_id)
  if (authUserError || !authUserData.user?.email) {
    console.error("[LIFF Login] auth ユーザー取得失敗:", authUserError)
    return NextResponse.json({ error: "auth_user_not_found" }, { status: 500 })
  }

  const { data: linkData, error: linkError } = await supabase.auth.admin.generateLink({
    type: "magiclink",
    email: authUserData.user.email,
  })
  if (linkError || !linkData.properties?.email_otp) {
    console.error("[LIFF Login] OTP 生成失敗:", linkError)
    return NextResponse.json({ error: "otp_generation_failed" }, { status: 500 })
  }

  console.log(`[LIFF Login] ログイン成功: userId=${user.id}`)
  return NextResponse.json({
    user,
    otp: { email: authUserData.user.email, token: linkData.properties.email_otp },
  })
}
