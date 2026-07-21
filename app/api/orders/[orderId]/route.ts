import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(
  _req: NextRequest,
  { params }: { params: { orderId: string } }
) {
  const { orderId } = params;
  if (!orderId) return NextResponse.json({ error: "orderId required" }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(`
      id, order_no, order_type, pickup_date, pickup_time,
      total_amount, subtotal, discount_amount,
      customer_name_snapshot, order_status, payment_status,
      cancel_deadline_at, payjp_charge_id, customer_id,
      stores(name, address, phone, invoice_num),
      order_items(id, product_name_snapshot, quantity, unit_price, subtotal, order_item_options(option_group_name_snapshot, option_item_name_snapshot, price_delta, quantity))
    `)
    .eq("id", orderId)
    .maybeSingle();

  if (error) return NextResponse.json({ error: "Failed to fetch order" }, { status: 500 });
  if (!data) return NextResponse.json({ error: "Order not found" }, { status: 404 });

  return NextResponse.json(data, {
    headers: { "Cache-Control": "no-store" },
  });
}
