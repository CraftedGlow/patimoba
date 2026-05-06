import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/liff/auth
// body: { userId: string (LINE), displayName: string, pictureUrl: string }
export async function POST(req: NextRequest) {
  try {
    const { userId: lineUserId, displayName, pictureUrl } = await req.json();

    if (!lineUserId) {
      return NextResponse.json({ error: "lineUserId is required" }, { status: 400 });
    }

    console.log("[liff/auth] lineUserId:", lineUserId, "displayName:", displayName);

    // 既存ユーザー検索
    const { data: existing } = await supabaseAdmin
      .from("users")
      .select("id, points")
      .eq("line_user_id", lineUserId)
      .maybeSingle();

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
