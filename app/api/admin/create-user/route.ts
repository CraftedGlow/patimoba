import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAppUser } from "@/lib/api-auth";

// POST /api/admin/create-user
// body: { email, password, mode?: "customer" }
// - mode: "customer" : 顧客の新規会員登録（app/customer/signup）。未ログインでも呼べる。
//                      作成されるのは auth ユーザーのみで、users 行（user_type='customer'）は
//                      クライアントがログイン後に自分で作成する。user_type を customer 以外にする
//                      ことは DB トリガー（20261106000000_restrict_user_type_changes.sql）で禁止している。
// - それ以外         : 管理画面からの店舗・管理者アカウント作成。アプリ管理者のログインが必須。
export async function POST(req: NextRequest) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json(
      { error: "サーバー設定が不足しています (SUPABASE_SERVICE_ROLE_KEY)" },
      { status: 500 }
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  try {
    const { email, password, mode } = await req.json();

    if (mode !== "customer") {
      const appUser = await getAuthenticatedAppUser(req, admin);
      if (!appUser) {
        return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
      }
      if (appUser.userType !== "admin") {
        return NextResponse.json({ error: "Forbidden" }, { status: 403 });
      }
    }

    if (!email || !password) {
      return NextResponse.json(
        { error: "メールアドレスとパスワードは必須です" },
        { status: 400 }
      );
    }
    if (typeof password !== "string" || password.length < 6) {
      return NextResponse.json(
        { error: "パスワードは6文字以上で設定してください" },
        { status: 400 }
      );
    }

    const cleanEmail = String(email).trim().toLowerCase();

    const { data, error } = await admin.auth.admin.createUser({
      email: cleanEmail,
      password,
      email_confirm: true,
    });

    if (error) {
      if (error.message.includes("already been registered")) {
        return NextResponse.json(
          { error: "このメールアドレスは既に登録されています" },
          { status: 409 }
        );
      }
      return NextResponse.json({ error: error.message }, { status: 400 });
    }

    return NextResponse.json({ userId: data.user.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "ユーザー作成に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
