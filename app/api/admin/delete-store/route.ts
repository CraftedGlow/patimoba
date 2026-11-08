import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";
import { getAuthenticatedAppUser } from "@/lib/api-auth";

export async function POST(req: NextRequest) {
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;

  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json(
      { error: "サーバー設定が不足しています" },
      { status: 500 }
    );
  }

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { autoRefreshToken: false, persistSession: false },
  });

  // 店舗全体とスタッフアカウントを完全削除する操作のため、運営者(admin)本人であることを確認する
  const appUser = await getAuthenticatedAppUser(req, admin);
  if (!appUser || appUser.userType !== "admin") {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  try {
    const { storeId } = await req.json();
    if (!storeId) {
      return NextResponse.json({ error: "storeId は必須です" }, { status: 400 });
    }

    // 0. stores.parent_store_id は ON DELETE RESTRICT のため、子店舗を持つマスター店舗は最後の
    //    stores 削除で必ず失敗する。注文・商品等を消してしまう前に検知して中断する
    const { count: childCount, error: childErr } = await admin
      .from("stores")
      .select("id", { count: "exact", head: true })
      .eq("parent_store_id", storeId);
    if (childErr) throw childErr;
    if ((childCount ?? 0) > 0) {
      return NextResponse.json(
        { error: `この店舗には子店舗が${childCount}件紐づいているため削除できません。先に子店舗を削除するか、マスター店舗から切り離してください` },
        { status: 409 }
      );
    }

    // 各削除ステップのエラーを握りつぶすと、途中まで消えた状態で次へ進んでしまうため失敗時は即中断する
    const check = <T extends { error: unknown }>(res: T): T => {
      if (res.error) throw res.error;
      return res;
    };

    // 1. store_users から user_id を取得（後で auth.users を削除するため）
    const { data: storeUsers } = check(await admin
      .from("store_users")
      .select("user_id")
      .eq("store_id", storeId));
    const storeUserIds = (storeUsers ?? [])
      .map((u) => u.user_id)
      .filter(Boolean) as string[];

    // users テーブルから auth_user_id を取得
    let authUserIds: string[] = [];
    if (storeUserIds.length > 0) {
      const { data: users } = check(await admin
        .from("users")
        .select("auth_user_id")
        .in("id", storeUserIds));
      authUserIds = (users ?? [])
        .map((u) => u.auth_user_id)
        .filter(Boolean) as string[];
    }

    // 2. orders に紐づく子テーブルを削除
    const { data: orders } = check(await admin
      .from("orders")
      .select("id")
      .eq("store_id", storeId));
    const orderIds = (orders ?? []).map((o) => o.id);

    if (orderIds.length > 0) {
      // order_items → order_item_options
      const { data: orderItems } = check(await admin
        .from("order_items")
        .select("id")
        .in("order_id", orderIds));
      const orderItemIds = (orderItems ?? []).map((oi) => oi.id);

      if (orderItemIds.length > 0) {
        check(await admin.from("order_item_options").delete().in("order_item_id", orderItemIds));
      }
      check(await admin.from("order_items").delete().in("order_id", orderIds));
    }

    // 3. products → product_variants
    const { data: products } = check(await admin
      .from("products")
      .select("id")
      .eq("store_id", storeId));
    const productIds = (products ?? []).map((p) => p.id);

    if (productIds.length > 0) {
      check(await admin.from("product_variants").delete().in("product_id", productIds));
    }

    // 4. store 直下の子テーブルを一括削除
    const directChildren = [
      "orders",
      "products",
      "store_users",
      "store_business_hours",
      "store_special_dates",
      "store_order_rules",
      "user_roles",
    ];

    for (const table of directChildren) {
      check(await admin.from(table).delete().eq("store_id", storeId));
    }

    // 5. stores 本体を削除
    const { error: storeErr } = await admin
      .from("stores")
      .delete()
      .eq("id", storeId);
    if (storeErr) throw storeErr;

    // 6. 紐づいていた store スタッフの users を削除
    if (storeUserIds.length > 0) {
      await admin.from("users").delete().in("id", storeUserIds);
    }

    // 7. 紐づいていた auth.users を削除
    for (const authUserId of authUserIds) {
      await admin.auth.admin.deleteUser(authUserId);
    }

    return NextResponse.json({ success: true });
  } catch (e) {
    console.error("[delete-store] error:", e);
    // Supabase のエラーは Error インスタンスでない場合があるため message を直接拾う
    const raw = (e as { message?: unknown } | null)?.message;
    const message = typeof raw === "string" && raw ? `店舗削除に失敗しました: ${raw}` : "店舗削除に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
