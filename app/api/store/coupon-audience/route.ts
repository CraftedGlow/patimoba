import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authorizeStoreStaff } from "@/lib/api-auth";
import { resolveEffectiveLiffId } from "@/lib/store-liff";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

/**
 * クーポン配信の母集団（この店舗のLIFFでログイン済み＝LINEユーザーIDが取得できている顧客）を返す。
 * 注文実績の有無は問わない。orders_select_staff などの通常のRLSでは「注文したことがある客」しか
 * 見えないため、store staff 権限を確認した上で service role で取得する。
 */
export async function GET(req: NextRequest) {
  const storeId = req.nextUrl.searchParams.get("storeId");
  if (!storeId) return NextResponse.json({ error: "storeId required" }, { status: 400 });

  const access = await authorizeStoreStaff(req, supabaseAdmin, storeId);
  if (!access.ok) return NextResponse.json({ error: access.error }, { status: access.status });

  const effectiveLiffId = await resolveEffectiveLiffId(storeId, supabaseAdmin);
  if (!effectiveLiffId) return NextResponse.json([]);

  const { data } = await supabaseAdmin
    .from("users")
    .select("id, name, line_name, gender")
    .eq("liff_id", effectiveLiffId)
    .not("line_user_id", "is", null)
    .order("created_at", { ascending: false });

  return NextResponse.json(
    (data ?? []).map((u) => ({
      id: u.id,
      name: u.name || u.line_name || "",
      lineName: u.line_name || "",
      gender: u.gender ?? null,
    })),
    { headers: { "Cache-Control": "no-store" } }
  );
}
