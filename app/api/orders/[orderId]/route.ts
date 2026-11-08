import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { authorizeStoreStaff, authorizeUserAccess } from "@/lib/api-auth";
import { ORDER_ACCESS_HEADER, isValidOrderAccessKey } from "@/lib/signed-value";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const { orderId } = params;
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(`
      id, order_no, order_type, pickup_date, pickup_time,
      total_amount, subtotal, discount_amount, coupon_discount_amount,
      customer_name_snapshot, order_status, payment_status,
      cancel_deadline_at, customer_id, store_id,
      stores(name, address, phone, invoice_num),
      order_items(id, product_name_snapshot, quantity, unit_price, subtotal, order_item_options(option_group_name_snapshot, option_item_name_snapshot, price_delta, quantity, free_quantity)),
      coupons(title)
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  // 注文の本人（未ログインのECゲスト注文はゲスト行に限り許可）、またはその店舗のスタッフのみ閲覧できる
  const { customer_id: customerId, store_id: storeId, ...order } = data;
  // 注文確認メールのリンク（その注文専用の鍵付き）から開いた場合は、ログインなしで閲覧できる
  const hasAccessKey = isValidOrderAccessKey(req.headers.get(ORDER_ACCESS_HEADER), orderId);
  const ownerAccess = !hasAccessKey && customerId ? await authorizeUserAccess(req, supabaseAdmin, customerId) : null;
  if (!hasAccessKey && !ownerAccess?.ok) {
    const staffAccess = await authorizeStoreStaff(req, supabaseAdmin, storeId);
    if (!staffAccess.ok) {
      const status = ownerAccess && !ownerAccess.ok ? ownerAccess.status : staffAccess.status;
      return NextResponse.json({ error: status === 401 ? "ログインが必要です" : "権限がありません" }, { status });
    }
  }

  // customer_id / store_id / 決済ID は画面で使わないためレスポンスに含めない
  return NextResponse.json(order, {
    headers: { "Cache-Control": "no-store" },
  });
}
