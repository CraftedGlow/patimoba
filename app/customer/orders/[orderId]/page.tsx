"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { supabase } from "@/lib/supabase";
import { LineSpinner } from "@/components/ui/line-spinner";
import { Calendar, ShoppingBag, CreditCard, Package } from "lucide-react";

type OrderItem = {
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
};

type OrderDetail = {
  id: string;
  order_no: string | null;
  order_type: string;
  pickup_date: string | null;
  pickup_time: string | null;
  total_amount: number;
  subtotal: number;
  discount_amount: number | null;
  customer_name_snapshot: string | null;
  order_status: string;
  payment_status: string;
  stores: { name: string; address: string } | null;
  order_items: OrderItem[];
};

const ORDER_TYPE_LABELS: Record<string, string> = {
  takeout: "店頭受け取り",
  ec: "配送",
};

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

function formatPickupDateTime(date: string | null, time: string | null): string {
  if (!date) return "未定";
  const d = new Date(date);
  const wday = WEEKDAY[d.getDay()];
  const base = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${wday}）`;
  return time ? `${base} ${time.slice(0, 5)}` : base;
}

export default function CustomerOrderDetailPage() {
  const params = useParams();
  const orderId = params?.orderId as string;

  const [order, setOrder] = useState<OrderDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!orderId) return;
    (async () => {
      const { data, error: err } = await supabase
        .from("orders")
        .select(`
          id, order_no, order_type, pickup_date, pickup_time,
          total_amount, subtotal, discount_amount,
          customer_name_snapshot, order_status, payment_status,
          stores(name, address),
          order_items(product_name_snapshot, quantity, unit_price, subtotal)
        `)
        .eq("id", orderId)
        .maybeSingle();

      if (err) {
        setError("注文情報の取得に失敗しました");
      } else if (!data) {
        setError("注文が見つかりませんでした");
      } else {
        setOrder(data as unknown as OrderDetail);
      }
      setLoading(false);
    })();
  }, [orderId]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white">
        <LineSpinner />
      </div>
    );
  }

  if (error || !order) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-white px-4">
        <p className="text-gray-500 text-sm text-center">{error ?? "注文が見つかりませんでした"}</p>
      </div>
    );
  }

  const pickupLabel = ORDER_TYPE_LABELS[order.order_type] ?? order.order_type;
  const datetimeStr = formatPickupDateTime(order.pickup_date, order.pickup_time);
  const hasDiscount = order.discount_amount != null && Number(order.discount_amount) > 0;

  return (
    <div className="min-h-screen bg-gray-50">
      {/* ヘッダー */}
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-gray-900 text-center">注文詳細</h1>
        {order.order_no && (
          <p className="text-xs text-gray-400 text-center mt-0.5">
            注文番号：{order.order_no}
          </p>
        )}
      </div>

      <div className="px-4 py-4 space-y-3 max-w-lg mx-auto">
        {/* 来店日時 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-4 h-4 text-pink-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-700">来店日時</span>
          </div>
          <p className="text-base font-bold text-gray-900 pl-6">{datetimeStr}</p>
        </div>

        {/* 注文内容 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <ShoppingBag className="w-4 h-4 text-pink-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-700">注文内容</span>
          </div>
          <div className="pl-6 space-y-2">
            {order.order_items.map((item, i) => (
              <div key={i} className="flex items-center justify-between gap-2">
                <span className="text-sm text-gray-800 leading-snug">{item.product_name_snapshot}</span>
                <span className="text-sm text-gray-500 whitespace-nowrap">×{item.quantity}</span>
              </div>
            ))}
          </div>
        </div>

        {/* 合計金額 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-3">
            <CreditCard className="w-4 h-4 text-pink-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-700">合計金額</span>
          </div>
          <div className="pl-6 space-y-1.5">
            <div className="flex justify-between text-sm text-gray-600">
              <span>小計</span>
              <span>¥{Number(order.subtotal).toLocaleString()}</span>
            </div>
            {hasDiscount && (
              <div className="flex justify-between text-sm text-green-600">
                <span>ポイント割引</span>
                <span>−¥{Number(order.discount_amount).toLocaleString()}</span>
              </div>
            )}
            <div className="flex justify-between text-base font-bold text-gray-900 pt-1.5 border-t border-gray-100 mt-0.5">
              <span>合計</span>
              <span>¥{Number(order.total_amount).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* 受け取り方法 */}
        <div className="bg-white rounded-xl p-4 shadow-sm">
          <div className="flex items-center gap-2 mb-2">
            <Package className="w-4 h-4 text-pink-400 flex-shrink-0" />
            <span className="text-sm font-semibold text-gray-700">受け取り方法</span>
          </div>
          <p className="text-sm text-gray-800 pl-6">{pickupLabel}</p>
          {order.stores?.name && (
            <p className="text-xs text-gray-500 pl-6 mt-0.5">{order.stores.name}</p>
          )}
        </div>
      </div>
    </div>
  );
}
