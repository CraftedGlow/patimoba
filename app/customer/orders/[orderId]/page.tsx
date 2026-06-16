"use client";

import { useState, useEffect } from "react";
import { useParams } from "next/navigation";
import { LineSpinner } from "@/components/ui/line-spinner";
import { Calendar, ShoppingBag, CreditCard, Package } from "lucide-react";

type OrderItemOption = {
  option_group_name_snapshot: string | null;
  option_item_name_snapshot: string | null;
  price_delta: number | null;
  quantity: number | null;
};

type OrderItem = {
  id: string;
  product_name_snapshot: string;
  quantity: number;
  unit_price: number;
  subtotal: number;
  order_item_options: OrderItemOption[];
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

function getOptionPrice(opt: OrderItemOption): number {
  const price = opt.price_delta ?? 0;
  const qty = opt.quantity ?? 1;
  return opt.option_group_name_snapshot === "ろうそく" ? price * qty : price;
}

function getOptionLabel(opt: OrderItemOption): string {
  const group = opt.option_group_name_snapshot ?? "";
  const name = opt.option_item_name_snapshot ?? "";
  const qty = opt.quantity ?? 1;
  if (group === "サイズ") return `サイズ：${name}`;
  if (group === "ろうそく") return qty > 1 ? `ろうそく：${name} ×${qty}` : `ろうそく：${name}`;
  if (group === "メッセージ") return `プレート：${name}`;
  return name;
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
      try {
        const res = await fetch(`/api/orders/${orderId}`);
        if (res.status === 404) {
          setError("注文が見つかりませんでした");
        } else if (!res.ok) {
          setError("注文情報の取得に失敗しました");
        } else {
          setOrder(await res.json());
        }
      } catch {
        setError("注文情報の取得に失敗しました");
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
          <div className="pl-6 space-y-3">
            {order.order_items.map((item, i) => {
              const opts = (item.order_item_options ?? []).filter(
                (o) => o.option_group_name_snapshot !== "アレルギー"
              );
              const hasOptions = opts.length > 0;

              if (!hasOptions) {
                return (
                  <div key={i} className="flex items-center justify-between gap-2">
                    <span className="text-sm text-gray-800 leading-snug">
                      {item.product_name_snapshot}
                    </span>
                    <span className="text-sm text-gray-600 whitespace-nowrap">
                      ×{item.quantity}　¥{Number(item.subtotal).toLocaleString()}
                    </span>
                  </div>
                );
              }

              return (
                <div
                  key={i}
                  className="space-y-1 pb-3 border-b border-gray-100 last:border-0 last:pb-0"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-medium text-gray-800">
                      {item.product_name_snapshot}
                    </span>
                    <span className="text-sm text-gray-500 whitespace-nowrap">×{item.quantity}</span>
                  </div>
                  <div className="pl-2 space-y-0.5">
                    {opts.map((opt, j) => {
                      const label = getOptionLabel(opt);
                      const price = getOptionPrice(opt);
                      return (
                        <div key={j} className="flex items-center justify-between gap-2">
                          <span className="text-xs text-gray-500">{label}</span>
                          {price > 0 && (
                            <span className="text-xs text-gray-500 whitespace-nowrap">
                              ¥{price.toLocaleString()}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                  <div className="flex items-center justify-between gap-2 pt-1 border-t border-gray-50">
                    <span className="text-xs text-gray-400">小計</span>
                    <span className="text-sm font-medium text-gray-700">
                      ¥{Number(item.subtotal).toLocaleString()}
                    </span>
                  </div>
                </div>
              );
            })}
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
              <span>¥{Number(order.total_amount).toLocaleString()}<span className="text-sm font-normal text-gray-500">（税込）</span></span>
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
          <p className="text-xs text-gray-500 pl-6 mt-2 leading-relaxed">
            {order.order_type === "takeout"
              ? "受け取り日時に、こちらの画面を店頭スタッフへご提示ください。"
              : "発送完了後、改めてご案内いたします。商品到着まで今しばらくお待ちください。"}
          </p>
        </div>
      </div>
    </div>
  );
}
