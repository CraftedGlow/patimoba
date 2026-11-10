import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { isDevOnlyStoreVisible } from "@/lib/store-visibility";
import { priceCartItems, type IncomingCartItem } from "@/lib/server/cart-pricing";
import { resolveShippingFee } from "@/lib/server/order-checkout";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

// POST /api/ec/shipping-fee
// body: { storeId, items, prefecture }
// EC会計画面に表示する送料を、注文確定時（/api/ec/create-order）と同じ計算（DB上の商品小計・店舗の配送設定）で返す。
// 画面側で別途計算した送料と確定時の送料がずれて、正しい注文が「金額が変更されました」で弾かれるのを防ぐ。
export async function POST(req: NextRequest) {
  try {
    const { storeId, items, prefecture }: { storeId: string; items: IncomingCartItem[]; prefecture?: string | null } =
      await req.json();
    if (!storeId || !Array.isArray(items) || items.length === 0) {
      return NextResponse.json({ error: "storeId, items are required" }, { status: 400 });
    }

    const { data: storeRow } = await supabaseAdmin.from("stores").select("is_dev_only").eq("id", storeId).maybeSingle();
    if (!storeRow || !isDevOnlyStoreVisible(storeRow.is_dev_only)) {
      return NextResponse.json({ error: "この店舗では注文できません" }, { status: 400 });
    }

    const pricing = await priceCartItems(supabaseAdmin, storeId, items, "ec");
    if (!pricing.ok) return NextResponse.json({ error: pricing.error }, { status: 400 });

    const shippingFee = await resolveShippingFee(
      supabaseAdmin,
      storeId,
      typeof prefecture === "string" && prefecture ? prefecture : undefined,
      pricing.subtotal
    );
    return NextResponse.json({ shippingFee, subtotal: pricing.subtotal });
  } catch (e) {
    console.error("[ec/shipping-fee] 例外:", e);
    return NextResponse.json({ error: "送料の計算に失敗しました" }, { status: 500 });
  }
}
