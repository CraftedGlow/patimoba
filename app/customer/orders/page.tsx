"use client";

import { useState, useEffect } from "react";
import Link from "next/link";
import { ShoppingBag } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import { authFetch } from "@/lib/auth-fetch";
import { type OrderSummary, ORDER_TYPE_LABELS, formatPickupDateTime, itemsSummary } from "@/lib/order-history";

export default function CustomerOrderHistoryPage() {
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      try {
        const res = await authFetch("/api/orders", { cache: "no-store" });
        if (res.status === 401) {
          setError("この機能を利用するには、注文したLINEアカウントでログインしてください");
        } else if (!res.ok) {
          setError("注文履歴の取得に失敗しました");
        } else {
          setOrders(await res.json());
        }
      } catch {
        setError("注文履歴の取得に失敗しました");
      }
    })();
  }, []);

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b px-4 py-4 sticky top-0 z-10">
        <h1 className="text-lg font-bold text-gray-900 text-center">注文履歴</h1>
      </div>

      <div className="px-4 py-4 space-y-3 max-w-lg mx-auto">
        {!orders && !error && (
          <div className="flex justify-center py-16">
            <LineSpinner size={30} />
          </div>
        )}

        {error && (
          <p className="text-sm text-red-500 text-center py-8">{error}</p>
        )}

        {orders && orders.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-16">まだご注文がありません</p>
        )}

        {orders?.map((order) => {
          const isCancelled = order.order_status === "cancelled";
          return (
            <Link
              key={order.id}
              href={`/customer/orders/${order.id}`}
              className="block bg-white rounded-xl p-4 shadow-sm"
            >
              <div className="flex items-center justify-between gap-2 mb-2">
                <span className="text-xs font-semibold text-gray-500">
                  {order.stores?.name ?? ""}・{ORDER_TYPE_LABELS[order.order_type] ?? order.order_type}
                </span>
                {isCancelled && (
                  <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full">
                    キャンセル済み
                  </span>
                )}
              </div>
              <div className="flex items-center gap-2 mb-1.5">
                <ShoppingBag className="w-4 h-4 text-[#FEBC2F] flex-shrink-0" />
                <span className="text-sm text-gray-800 truncate">{itemsSummary(order.order_items)}</span>
              </div>
              <div className="flex items-center justify-between gap-2">
                <span className="text-xs text-gray-500">
                  {formatPickupDateTime(order.pickup_date, order.pickup_time)}
                </span>
                <span className="text-sm font-bold text-gray-900">
                  ¥{Number(order.total_amount).toLocaleString()}
                </span>
              </div>
            </Link>
          );
        })}
      </div>
    </div>
  );
}
