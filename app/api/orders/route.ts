import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { getAuthenticatedAppUser } from "@/lib/api-auth";

export const dynamic = "force-dynamic";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export async function GET(req: NextRequest) {
  const appUser = await getAuthenticatedAppUser(req, supabaseAdmin);
  if (!appUser) return NextResponse.json({ error: "ログインが必要です" }, { status: 401 });

  const { data, error } = await supabaseAdmin
    .from("orders")
    .select(`
      id, order_no, order_type, pickup_date, pickup_time, total_amount, order_status, created_at,
      stores(name),
      order_items(product_name_snapshot, quantity)
    `)
    .eq("customer_id", appUser.id)
    .order("created_at", { ascending: false })
    .limit(100);

  if (error) return NextResponse.json({ error: "Failed to fetch orders" }, { status: 500 });

  return NextResponse.json(data ?? [], {
    headers: { "Cache-Control": "no-store" },
  });
}
