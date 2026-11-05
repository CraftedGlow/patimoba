import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { payjpPost } from "@/lib/payjp";
import { getAuthenticatedAppUser, isGuestUserId } from "@/lib/api-auth";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/payjp/charge
// body: { userId, storeId, amount, currency? }
export async function POST(req: NextRequest) {
  try {
    const { userId, storeId, amount, currency = "jpy" } = await req.json();

    if (!userId || !storeId || !amount) {
      return NextResponse.json(
        { error: "userId, storeId, amount は必須です" },
        { status: 400 }
      );
    }

    // 他人のカードに課金できてしまわないよう、呼び出し元を確認する。
    // ・ログイン済みなら、リクエストのuserIdが認証済み本人と一致すること
    // ・ログインセッションが無い場合は、LINE未ログインのEC決済ゲスト専用行
    //   （auth_user_idを持たない）に対してのみ許可する（本物のアカウントへの
    //   なりすまし課金を防ぐ）
    const appUser = await getAuthenticatedAppUser(req, supabaseAdmin);
    if (appUser) {
      if (appUser.id !== userId) {
        return NextResponse.json({ error: "権限がありません" }, { status: 403 });
      }
    } else if (!(await isGuestUserId(supabaseAdmin, userId))) {
      return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });
    }

    // users テーブルから customer_id を取得
    const { data: user, error: userErr } = await supabaseAdmin
      .from("users")
      .select("customer_id")
      .eq("id", userId)
      .maybeSingle();

    if (userErr || !user?.customer_id) {
      return NextResponse.json(
        { error: "カード情報が登録されていません" },
        { status: 400 }
      );
    }

    // stores テーブルから payjp_tenant_id を取得
    const { data: store, error: storeErr } = await supabaseAdmin
      .from("stores")
      .select("tenant_id")
      .eq("id", storeId)
      .maybeSingle();

    if (storeErr || !store?.tenant_id) {
      return NextResponse.json(
        { error: "店舗のテナント情報が設定されていません" },
        { status: 400 }
      );
    }

    const res = await payjpPost("/charges", {
      amount: String(amount),
      currency,
      customer: user.customer_id,
      tenant: store.tenant_id,
    });

    const data = await res.json();

    if (!res.ok) {
      return NextResponse.json({ error: data.error }, { status: res.status });
    }

    return NextResponse.json({ chargeId: data.id });
  } catch (e) {
    const message = e instanceof Error ? e.message : "決済に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
