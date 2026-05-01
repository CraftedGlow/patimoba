import { NextRequest, NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { sendOrderLineMessage } from "@/lib/line";

const supabaseAdmin = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

interface CartItem {
  productId: string;
  name: string;
  price: number;
  quantity: number;
  isEc?: boolean;
  isTakeout?: boolean;
  isCustomCake?: boolean;
  customization?: {
    sizeId?: string;
    sizeLabel?: string;
    sizePrice?: number;
    candles?: { candleOptionId: string; name: string; price: number; quantity: number }[];
    options?: { wholeCakeOptionId: string; name: string; price: number; groupName?: string }[];
    messagePlate?: string;
    allergyNote?: string;
    customOptions?: { name: string; values: string[]; additionalPrice: number }[];
  };
}

function calcItemSubtotal(item: CartItem): number {
  const c = item.customization;
  if (!c) return item.price * item.quantity;
  const candleSum = (c.candles || []).reduce((s, cd) => s + cd.price * cd.quantity, 0);
  const optionSum = (c.options || []).reduce((s, op) => s + op.price, 0);
  return (item.price * item.quantity) + ((c.sizePrice ?? 0) + candleSum + optionSum) * item.quantity;
}

export async function POST(req: NextRequest) {
  try {
    const {
      storeId,
      customerId,
      paymentStatus,
      items,
      subtotal,
      discountAmount,
      notes,
      guestEmail,
      customerName,
    }: {
      storeId: string;
      customerId: string | null;
      paymentStatus: string;
      items: CartItem[];
      subtotal: number;
      discountAmount: number;
      notes?: string;
      guestEmail?: string | null;
      customerName?: string | null;
    } = await req.json();

    if (!storeId || !items?.length) {
      return NextResponse.json({ error: "storeId and items are required" }, { status: 400 });
    }

    const totalAmount = subtotal - (discountAmount ?? 0);

    const { data: order, error: orderErr } = await supabaseAdmin
      .from("orders")
      .insert({
        store_id: storeId,
        customer_id: customerId ?? null,
        order_type: "ec",
        order_status: "pending",
        payment_status: paymentStatus ?? "unpaid",
        subtotal,
        discount_amount: discountAmount ?? 0,
        total_amount: totalAmount,
        pickup_date: null,
        pickup_time: null,
        notes: notes ?? "",
        guest_email: guestEmail ?? null,
        customer_name_snapshot: customerName ?? null,
      })
      .select("id")
      .single();

    if (orderErr || !order) {
      return NextResponse.json({ error: orderErr?.message || "注文の作成に失敗しました" }, { status: 500 });
    }

    const orderItems = items.map((item) => ({
      order_id: order.id,
      product_id: item.productId,
      product_name_snapshot: item.name,
      quantity: item.quantity,
      unit_price: item.price,
      subtotal: calcItemSubtotal(item),
      variant_name_snapshot: item.customization?.sizeLabel ?? null,
    }));

    const { data: insertedItems, error: itemsErr } = await supabaseAdmin
      .from("order_items")
      .insert(orderItems)
      .select("id");

    if (itemsErr) {
      await supabaseAdmin.from("orders").delete().eq("id", order.id);
      return NextResponse.json({ error: itemsErr.message }, { status: 500 });
    }

    for (let i = 0; i < items.length; i++) {
      const item = items[i];
      const insertedId = insertedItems?.[i]?.id;
      if (!item.isCustomCake || !item.customization || !insertedId) continue;
      const c = item.customization;

      const options: any[] = [];
      if (c.sizeId) {
        options.push({
          order_item_id: insertedId,
          option_group_name_snapshot: "サイズ",
          option_item_name_snapshot: c.sizeLabel ?? "",
          price_delta: c.sizePrice ?? 0,
        });
      }
      for (const cd of c.candles || []) {
        if (!cd.candleOptionId || cd.quantity <= 0) continue;
        options.push({
          order_item_id: insertedId,
          option_group_name_snapshot: "ろうそく",
          option_item_name_snapshot: cd.name,
          price_delta: cd.price,
          quantity: cd.quantity,
        });
      }
      for (const op of c.options || []) {
        if (!op.wholeCakeOptionId) continue;
        options.push({
          order_item_id: insertedId,
          option_group_name_snapshot: op.groupName ?? "デコレーション",
          option_item_name_snapshot: op.name,
          price_delta: op.price,
        });
      }
      if (c.messagePlate) {
        options.push({
          order_item_id: insertedId,
          option_group_name_snapshot: "メッセージ",
          option_item_name_snapshot: c.messagePlate,
          price_delta: 0,
        });
      }
      if (c.allergyNote) {
        options.push({
          order_item_id: insertedId,
          option_group_name_snapshot: "アレルギー",
          option_item_name_snapshot: c.allergyNote,
          price_delta: 0,
        });
      }
      if (options.length > 0) {
        await supabaseAdmin.from("order_item_options").insert(options);
      }
    }

    // 注文完了後にLINE push通知を送信（失敗してもorder作成は成功扱い）
    sendOrderLineMessage(order.id).catch((lineErr) =>
      console.error("LINE send error (non-fatal):", lineErr)
    );

    return NextResponse.json({ orderId: order.id });
  } catch (e: any) {
    console.error("create-order error:", e);
    return NextResponse.json({ error: "Internal error" }, { status: 500 });
  }
}
