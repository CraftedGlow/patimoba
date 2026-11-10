import { NextRequest, NextResponse } from "next/server"
import { createClient } from "@supabase/supabase-js"
import { cookies } from "next/headers"
import type { Database } from "@/lib/database.types"
import { LINE_PENDING_USER_PURPOSE, verifySignedValue } from "@/lib/signed-value"

export async function POST(request: NextRequest) {
  const cookieStore = await cookies()
  // line_pending_user はサーバーが LINE 認証後に署名して発行した値のみ受け付ける
  // （lib/signed-value.ts）。署名なし・改ざん・期限切れの値は未認証として拒否する。
  // ※ 現状このクッキーを発行する処理は無いため、発行側を実装するまでは常に拒否される。
  const raw = verifySignedValue(LINE_PENDING_USER_PURPOSE, cookieStore.get("line_pending_user")?.value)

  if (!raw) {
    return NextResponse.json({ error: "session_expired" }, { status: 401 })
  }

  let pendingUser: { lineUserId: string; lineName: string; avatarUrl: string | null }
  try {
    pendingUser = JSON.parse(raw)
  } catch {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 })
  }
  if (!pendingUser?.lineUserId || typeof pendingUser.lineUserId !== "string") {
    return NextResponse.json({ error: "invalid_session" }, { status: 400 })
  }

  const body = await request.json().catch(() => null)
  const { name, email, password } = body ?? {}

  if (!name || !email || !password) {
    return NextResponse.json({ error: "missing_fields" }, { status: 400 })
  }
  if (password.length < 6) {
    return NextResponse.json({ error: "password_too_short" }, { status: 400 })
  }

  const supabase = createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!
  )

  // 既存 users レコード（line_user_id あり）の確認。既にログイン用アカウントに紐づいた行は
  // 上書きしない（他人のアカウントの auth_user_id を差し替えて乗っ取れないようにする）
  const { data: lineRows, error: lookupError } = await supabase
    .from("users")
    .select("id, auth_user_id")
    .eq("line_user_id", pendingUser.lineUserId)
    .order("created_at", { ascending: true })
  if (lookupError) {
    console.error("[LINE Register] user lookup failed:", lookupError)
    return NextResponse.json({ error: "user_lookup_failed" }, { status: 500 })
  }
  if ((lineRows ?? []).some((r) => r.auth_user_id)) {
    return NextResponse.json({ error: "already_registered" }, { status: 409 })
  }
  const existingUser = lineRows?.[0] ?? null

  // Supabase auth ユーザー作成
  const { data: authData, error: authError } = await supabase.auth.admin.createUser({
    email: email.trim().toLowerCase(),
    password,
    email_confirm: true,
  })

  if (authError) {
    const msg = authError.message?.toLowerCase() ?? ""
    if (msg.includes("already") || msg.includes("email")) {
      return NextResponse.json({ error: "email_already_used" }, { status: 409 })
    }
    console.error("[LINE Register] auth creation failed:", authError)
    return NextResponse.json({ error: "auth_creation_failed" }, { status: 500 })
  }

  const authUserId = authData.user.id

  // 既存 users レコード（line_user_id あり・auth_user_id なし）の更新 or 新規作成
  let userRecord
  if (existingUser) {
    const { data, error } = await supabase
      .from("users")
      .update({
        auth_user_id: authUserId,
        name,
        email: email.trim().toLowerCase(),
        line_name: pendingUser.lineName,
        avatar_url: pendingUser.avatarUrl,
      })
      .eq("id", existingUser.id)
      // 同時リクエストで紐づけ済みになった行は上書きしない
      .is("auth_user_id", null)
      .select()
      .maybeSingle()

    if (error || !data) {
      console.error("[LINE Register] user update failed:", error ?? "already linked")
      await supabase.auth.admin.deleteUser(authUserId).catch(() => {})
      return error
        ? NextResponse.json({ error: "user_update_failed" }, { status: 500 })
        : NextResponse.json({ error: "already_registered" }, { status: 409 })
    }
    userRecord = data
  } else {
    const { data, error } = await supabase
      .from("users")
      .insert({
        auth_user_id: authUserId,
        user_type: "customer",
        line_user_id: pendingUser.lineUserId,
        line_name: pendingUser.lineName,
        name,
        email: email.trim().toLowerCase(),
        avatar_url: pendingUser.avatarUrl,
      })
      .select()
      .single()

    if (error) {
      console.error("[LINE Register] user insert failed:", error)
      return NextResponse.json({ error: "user_creation_failed" }, { status: 500 })
    }
    userRecord = data
  }

  const response = NextResponse.json({ user: userRecord })
  response.cookies.delete("line_pending_user")
  return response
}
