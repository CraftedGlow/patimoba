import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

export async function POST(request: NextRequest) {
  const body = await request.json().catch(() => null)
  const idToken = body?.idToken

  if (!idToken) {
    return NextResponse.json({ error: "id_token_required" }, { status: 400 })
  }

  const channelId = process.env.LINE_LOGIN_CHANNEL_ID
  if (!channelId) {
    return NextResponse.json({ error: "server_misconfigured", detail: "LINE_LOGIN_CHANNEL_ID missing" }, { status: 500 })
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
  const lineName: string = verified.name ?? ""
  const avatarUrl: string | null = verified.picture ?? null

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    serviceRoleKey
  )

  // LINE ユーザーID で既存ユーザーを検索
  let { data: user } = await supabase
    .from("users")
    .select("*")
    .eq("line_user_id", lineUserId)
    .maybeSingle()

  // ── 新規ユーザー：Supabase auth + users レコードを自動作成 ──────────────
  if (!user) {
    console.log(`[LIFF Login] 新規ユーザー自動作成: lineUserId=${lineUserId}`)
    const fakeEmail = `line_${lineUserId}@patimoba.internal`

    let authUserId: string
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: fakeEmail,
      email_confirm: true,
      user_metadata: { line_user_id: lineUserId },
    })

    if (authData?.user) {
      authUserId = authData.user.id
    } else if (authError) {
      // Email already registered from a prior partial failure — look up by email
      const { data: listData, error: listError } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const existing = listData?.users?.find((u) => u.email === fakeEmail)
      if (existing) {
        console.log(`[LIFF Login] 既存 auth user を再利用: ${existing.id}`)
        authUserId = existing.id
      } else {
        console.error("[LIFF Login] auth ユーザー作成失敗:", authError, "listError:", listError)
        return NextResponse.json({ error: "auth_create_failed", detail: authError.message }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: "auth_create_failed", detail: "no user returned" }, { status: 500 })
    }

    const { data: newUser, error: insertError } = await supabase
      .from("users")
      .insert({
        line_user_id: lineUserId,
        line_name: lineName,
        avatar_url: avatarUrl,
        user_type: "customer",
        auth_user_id: authUserId,
      })
      .select()
      .single()

    if (insertError || !newUser) {
      console.error("[LIFF Login] users 挿入失敗:", insertError)
      return NextResponse.json({ error: "user_create_failed", detail: insertError?.message }, { status: 500 })
    }

    user = newUser
    console.log(`[LIFF Login] 新規作成完了: userId=${user.id}`)
  }

  // ── 既存ユーザーのLINEプロフィールを最新情報で更新（空値は上書きしない）────
  const profileUpdates: Record<string, string> = {}
  if (lineName && user.line_name !== lineName) profileUpdates.line_name = lineName
  if (avatarUrl && user.avatar_url !== avatarUrl) profileUpdates.avatar_url = avatarUrl
  if (Object.keys(profileUpdates).length > 0) {
    await supabase.from("users").update(profileUpdates).eq("id", user.id)
    user = { ...user, ...profileUpdates }
  }

  // ── auth_user_id 未設定の既存ユーザー：自動でリンク ───────────────────
  if (!user.auth_user_id) {
    console.log(`[LIFF Login] auth_user_id 未設定 → 自動リンク: userId=${user.id}`)
    const fakeEmail = `line_${lineUserId}@patimoba.internal`

    let authUserId: string
    const { data: authData, error: authError } = await supabase.auth.admin.createUser({
      email: fakeEmail,
      email_confirm: true,
      user_metadata: { line_user_id: lineUserId },
    })

    if (authData?.user) {
      authUserId = authData.user.id
    } else if (authError) {
      const { data: listData } = await supabase.auth.admin.listUsers({ page: 1, perPage: 1000 })
      const existing = listData?.users?.find((u) => u.email === fakeEmail)
      if (existing) {
        authUserId = existing.id
      } else {
        console.error("[LIFF Login] auth リンク作成失敗:", authError)
        return NextResponse.json({ error: "auth_link_failed", detail: authError.message }, { status: 500 })
      }
    } else {
      return NextResponse.json({ error: "auth_link_failed", detail: "no user returned" }, { status: 500 })
    }

    await supabase.from("users").update({ auth_user_id: authUserId }).eq("id", user.id)
    user = { ...user, auth_user_id: authUserId }
  }

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
  return NextResponse.json({
    user,
    otp: { email: authUserData.user.email, token: linkData.properties.email_otp },
  })
}
