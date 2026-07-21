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

  // ユーザーが存在しない、またはauth_user_idが未設定の場合は自動作成・リンク
  let user = existingUser
  const fakeEmail = `line_${lineUserId}@patimoba.internal`

  if (!user) {
    // auth.users 作成 or 既存取得
    let authUserId: string
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: fakeEmail,
      email_confirm: true,
      user_metadata: { line_user_id: lineUserId },
    })

    if (authData?.user) {
      authUserId = authData.user.id
    } else if (authError) {
      const { data: linkData } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: fakeEmail,
      })
      if (!linkData?.user?.id) {
        console.error("[LINE Auth] auth user 作成失敗:", authError)
        return NextResponse.redirect(new URL("/customer/login?error=server_error", request.url))
      }
      authUserId = linkData.user.id
    } else {
      return NextResponse.redirect(new URL("/customer/login?error=server_error", request.url))
    }

    // auth_user_id で既存の public.users を検索（line_user_id 未設定のケース）
    const { data: existingByAuth } = await supabase
      .from("users")
      .select("*")
      .eq("auth_user_id", authUserId)
      .maybeSingle()

    if (existingByAuth) {
      // 既存レコードに line_user_id を紐づけ
      await supabase
        .from("users")
        .update({ line_user_id: lineUserId, line_name: displayName, avatar_url: pictureUrl ?? existingByAuth.avatar_url })
        .eq("id", existingByAuth.id)
      user = { ...existingByAuth, line_user_id: lineUserId }
    } else {
      // 新規作成
      const { data: newUser, error: insertError } = await supabase
        .from("users")
        .insert({
          line_user_id: lineUserId,
          line_name: displayName,
          avatar_url: pictureUrl ?? null,
          user_type: "customer",
          auth_user_id: authUserId,
        })
        .select()
        .single()

      if (insertError || !newUser) {
        console.error("[LINE Auth] users 挿入失敗:", insertError)
        return NextResponse.redirect(new URL("/customer/login?error=server_error", request.url))
      }

      user = newUser
    }
  } else if (!user.auth_user_id) {
    // public.users は存在するが auth_user_id 未設定 → auth.users を作成してリンク
    let authUserId: string
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: fakeEmail,
      email_confirm: true,
      user_metadata: { line_user_id: lineUserId },
    })

    if (authData?.user) {
      authUserId = authData.user.id
    } else if (authError) {
      const { data: linkData } = await supabase.auth.admin.generateLink({
        type: "magiclink",
        email: fakeEmail,
      })
      if (!linkData?.user?.id) {
        console.error("[LINE Auth] auth user リンク失敗:", authError)
        return NextResponse.redirect(new URL("/customer/login?error=server_error", request.url))
      }
      authUserId = linkData.user.id
    } else {
      return NextResponse.redirect(new URL("/customer/login?error=server_error", request.url))
    }

    await supabase.from("users").update({ auth_user_id: authUserId }).eq("id", user.id)
    user = { ...user, auth_user_id: authUserId }
  } else {
    // 表示名・アイコンが変わっていれば更新
    await supabase
      .from("users")
      .update({
        line_name: displayName,
        avatar_url: pictureUrl ?? user.avatar_url,
      })
      .eq("id", user.id)
  }

  // Step 4: セッション引き渡し用クッキーをセット (1分間有効)
  const response = NextResponse.redirect(
    new URL("/customer/line-callback", request.url)
  )

  response.cookies.delete("line_oauth_state")

  response.cookies.set("line_session_uid", user.id, {
    httpOnly: true,
    maxAge: 60,
    path: "/",
    sameSite: "lax",
  })

  return response
}
