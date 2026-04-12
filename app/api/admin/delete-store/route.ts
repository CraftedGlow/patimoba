import { createClient } from "@supabase/supabase-js";
import { NextRequest, NextResponse } from "next/server";

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

  try {
    const { storeId } = await req.json();
    if (!storeId) {
      return NextResponse.json({ error: "storeId は必須です" }, { status: 400 });
    }

    // 1. store_users から user_id を取得（後で auth.users を削除するため）
    const { data: storeUsers } = await admin
      .from("store_users")
      .select("user_id")
      .eq("store_id", storeId);
    const storeUserIds = (storeUsers ?? [])
      .map((u) => u.user_id)
      .filter(Boolean) as string[];

    // users テーブルから auth_user_id を取得
    let authUserIds: string[] = [];
    if (storeUserIds.length > 0) {
      const { data: users } = await admin
        .from("users")
        .select("auth_user_id")
        .in("id", storeUserIds);
      authUserIds = (users ?? [])
        .map((u) => u.auth_user_id)
        .filter(Boolean) as string[];
    }

    // 2. orders に紐づく子テーブルを削除
    const { data: orders } = await admin
      .from("orders")
      .select("id")
      .eq("store_id", storeId);
    const orderIds = (orders ?? []).map((o) => o.id);

    if (orderIds.length > 0) {
      // order_items → order_item_options
      const { data: orderItems } = await admin
        .from("order_items")
        .select("id")
        .in("order_id", orderIds);
      const orderItemIds = (orderItems ?? []).map((oi) => oi.id);

      if (orderItemIds.length > 0) {
        await admin.from("order_item_options").delete().in("order_item_id", orderItemIds);
      }
      await admin.from("order_items").delete().in("order_id", orderIds);
    }

    // 3. products → product_variants
    const { data: products } = await admin
      .from("products")
      .select("id")
      .eq("store_id", storeId);
    const productIds = (products ?? []).map((p) => p.id);

    if (productIds.length > 0) {
      await admin.from("product_variants").delete().in("product_id", productIds);
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
      await admin.from(table).delete().eq("store_id", storeId);
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
    const message = e instanceof Error ? e.message : "店舗削除に失敗しました";
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
