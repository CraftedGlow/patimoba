import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

type LineTokenResponse = {
  access_token: string
  token_type: string
  refresh_token: string
  expires_in: number
  scope: string
  id_token?: string
}

type LineProfile = {
  userId: string
  displayName: string
  pictureUrl?: string
  statusMessage?: string
}

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url)
  const code = searchParams.get("code")
  const state = searchParams.get("state")
  const lineError = searchParams.get("error")

  if (lineError) {
    return NextResponse.redirect(
      new URL(`/customer/login?error=line_denied`, request.url)
    )
  }

  const storedState = request.cookies.get("line_oauth_state")?.value
  if (!code || !storedState || state !== storedState) {
    return NextResponse.redirect(
      new URL(`/customer/login?error=invalid_state`, request.url)
    )
  }

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID
  const channelSecret = process.env.LINE_LOGIN_CHANNEL_SECRET
  const redirectUri = process.env.LINE_LOGIN_REDIRECT_URI

  if (!channelId || !channelSecret || !redirectUri) {
    return NextResponse.redirect(
      new URL(`/customer/login?error=server_error`, request.url)
    )
  }

  // Step 1: code → アクセストークン取得
  const tokenRes = await fetch("https://api.line.me/oauth2/v2.1/token", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({
      grant_type: "authorization_code",
      code,
      redirect_uri: redirectUri,
      client_id: channelId,
      client_secret: channelSecret,
    }),
  })

  if (!tokenRes.ok) {
    const body = await tokenRes.text()
    console.error("[LINE Auth] token exchange failed:", body)
    return NextResponse.redirect(
      new URL(`/customer/login?error=token_failed`, request.url)
    )
  }

  const tokenData: LineTokenResponse = await tokenRes.json()

  // Step 2: プロフィール取得
  const profileRes = await fetch("https://api.line.me/v2/profile", {
    headers: { Authorization: `Bearer ${tokenData.access_token}` },
  })

  if (!profileRes.ok) {
    return NextResponse.redirect(
      new URL(`/customer/login?error=profile_failed`, request.url)
    )
  }

  const profile: LineProfile = await profileRes.json()
  const { userId: lineUserId, displayName, pictureUrl } = profile

  // Step 3: Supabase でユーザー検索 (service role で RLS バイパス)
  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  const { data: existingUser } = await supabase
    .from("users")
    .select("*")
    .eq("line_user_id", lineUserId)
    .maybeSingle()

  // auth_user_id が紐づいていない場合は登録画面へ
  if (!existingUser || !existingUser.auth_user_id) {
    const pendingData = JSON.stringify({
      lineUserId,
      lineName: displayName,
      avatarUrl: pictureUrl ?? null,
    })

    const registerResponse = NextResponse.redirect(
      new URL("/customer/line-register", request.url)
    )
    registerResponse.cookies.delete("line_oauth_state")
    registerResponse.cookies.set("line_pending_user", pendingData, {
      httpOnly: true,
      maxAge: 300,
      path: "/",
      sameSite: "lax",
    })
    return registerResponse
  }

  // 表示名・アイコンが変わっていれば更新
  await supabase
    .from("users")
    .update({
      line_name: displayName,
      avatar_url: pictureUrl ?? existingUser.avatar_url,
    })
    .eq("id", existingUser.id)

  // Step 4: セッション引き渡し用クッキーをセット (1分間有効)
  const response = NextResponse.redirect(
    new URL("/customer/line-callback", request.url)
  )

  response.cookies.delete("line_oauth_state")

  response.cookies.set("line_session_uid", existingUser.id, {
    httpOnly: true,
    maxAge: 60,
    path: "/",
    sameSite: "lax",
  })

  return response
}
