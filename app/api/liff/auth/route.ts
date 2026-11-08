import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { verifyLiffIdToken } from "@/lib/line-user";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/liff/auth
// body: { idToken: string (liff.getIDToken()), liffId?: string, displayName?: string, pictureUrl?: string }
// LINE ユーザーIDはクライアント申告値を使わず、ID トークンを LINE で検証して得た sub を使う
// （app/api/line/liff-login と同じ検証）。
export async function POST(req: NextRequest) {
  try {
    const body = await req.json().catch(() => null);
    const idToken = body?.idToken;
    if (!idToken) {
      return NextResponse.json({ error: "id_token_required" }, { status: 400 });
    }
    const liffId: string | null = body?.liffId ? String(body.liffId) : null;

    const verifyResult = await verifyLiffIdToken(supabaseAdmin, String(idToken), liffId);
    if (!verifyResult.ok) {
      return NextResponse.json({ error: verifyResult.error }, { status: verifyResult.status });
    }
    const lineUserId = verifyResult.claims.sub;
    const displayName: string | undefined = body?.displayName ?? verifyResult.claims.name;
    const pictureUrl: string | undefined = body?.pictureUrl ?? verifyResult.claims.picture;

    console.log("[liff/auth] lineUserId:", lineUserId, "displayName:", displayName);

    // 既存ユーザー検索（重複行があってもエラーで新規作成に流れないよう limit で1件に絞る）
    const { data: existingRows, error: lookupError } = await supabaseAdmin
      .from("users")
      .select("id, points")
      .eq("line_user_id", lineUserId)
      .order("created_at", { ascending: true })
      .limit(1);
    if (lookupError) {
      console.error("[liff/auth] lookup error:", lookupError);
      return NextResponse.json({ error: "ユーザー検索に失敗しました" }, { status: 500 });
    }
    const existing = existingRows?.[0];

    if (existing) {
      await supabaseAdmin
        .from("users")
        .update({ line_name: displayName, avatar_url: pictureUrl })
        .eq("id", existing.id);
      console.log("[liff/auth] existing user:", existing.id);
      return NextResponse.json({ userId: existing.id, points: existing.points ?? 0 });
    }

    // 新規作成
    const { data: newUser, error } = await supabaseAdmin
      .from("users")
      .insert({
        line_user_id: lineUserId,
        line_name: displayName,
        avatar_url: pictureUrl,
        user_type: "customer",
        points: 0,
      })
      .select("id")
      .single();

    if (error || !newUser) {
      console.error("[liff/auth] insert error:", error);
      return NextResponse.json({ error: "ユーザー作成に失敗しました" }, { status: 500 });
    }

    console.log("[liff/auth] new user created:", newUser.id);
    return NextResponse.json({ userId: newUser.id, points: 0 });
  } catch (e) {
    const message = e instanceof Error ? e.message : "認証に失敗しました";
    console.error("[liff/auth] 例外:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
