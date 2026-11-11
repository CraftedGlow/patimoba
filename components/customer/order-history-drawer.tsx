"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import { X, ClipboardCheck } from "lucide-react";
import { authFetch } from "@/lib/auth-fetch";
import { type OrderSummary, ORDER_TYPE_LABELS, formatPickupDateTime, itemsSummary } from "@/lib/order-history";

interface OrderHistoryDrawerProps {
  open: boolean;
  onClose: () => void;
}

export function OrderHistoryDrawer({ open, onClose }: OrderHistoryDrawerProps) {
  const router = useRouter();
  const [isDesktop, setIsDesktop] = useState(false);
  const [orders, setOrders] = useState<OrderSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const mq = window.matchMedia("(min-width: 768px)");
    setIsDesktop(mq.matches);
    const handler = (e: MediaQueryListEvent) => setIsDesktop(e.matches);
    mq.addEventListener("change", handler);
    return () => mq.removeEventListener("change", handler);
  }, []);

  useEffect(() => {
    if (!open || orders || error) return;
    (async () => {
      try {
        const res = await authFetch("/api/orders", { cache: "no-store" });
        if (res.status === 401) {
          setError("ログインすると注文履歴を確認できます");
        } else if (!res.ok) {
          setError("注文履歴の取得に失敗しました");
        } else {
          setOrders(await res.json());
        }
      } catch {
        setError("注文履歴の取得に失敗しました");
      }
    })();
  }, [open, orders, error]);

  const handleSelectOrder = (orderId: string) => {
    onClose();
    router.push(`/customer/orders/${orderId}`);
  };

  const panelContent = (
    <>
      {!isDesktop && (
        <div className="flex items-center justify-center pt-3 pb-1">
          <div className="w-10 h-1 rounded-full bg-gray-300" />
        </div>
      )}

      <div
        className={`flex items-center justify-between px-6 pb-4 border-b border-gray-100 ${
          isDesktop ? "pt-6" : "pt-2"
        }`}
      >
        <div className="flex items-center gap-2">
          <ClipboardCheck className="w-5 h-5 text-[var(--ec-500,#f59e0b)]" />
          <h2 className="text-lg font-bold text-gray-900">注文履歴</h2>
        </div>
        <button
          onClick={onClose}
          className="w-8 h-8 rounded-full flex items-center justify-center hover:bg-gray-100 transition-colors"
        >
          <X className="w-5 h-5 text-gray-500" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto px-6 py-4">
        {!orders && !error && (
          <p className="text-sm text-gray-500 text-center py-10">読み込み中...</p>
        )}

        {error && <p className="text-sm text-gray-500 text-center py-10">{error}</p>}

        {orders && orders.length === 0 && (
          <p className="text-sm text-gray-500 text-center py-10">まだご注文がありません</p>
        )}

        <div className="space-y-3">
          {orders?.map((order) => {
            const isCancelled = order.order_status === "cancelled";
            return (
              <button
                key={order.id}
                onClick={() => handleSelectOrder(order.id)}
                className="block w-full text-left bg-gray-50 hover:bg-gray-100 rounded-xl p-3.5 transition-colors"
              >
                <div className="flex items-center justify-between gap-2 mb-1.5">
                  <span className="text-xs font-semibold text-gray-500 truncate">
                    {order.stores?.name ?? ""}・{ORDER_TYPE_LABELS[order.order_type] ?? order.order_type}
                  </span>
                  {isCancelled && (
                    <span className="text-xs font-bold text-red-500 bg-red-50 px-2 py-0.5 rounded-full flex-shrink-0">
                      キャンセル済み
                    </span>
                  )}
                </div>
                <p className="text-sm text-gray-800 truncate mb-1">{itemsSummary(order.order_items)}</p>
                <div className="flex items-center justify-between gap-2">
                  <span className="text-xs text-gray-500">
                    {formatPickupDateTime(order.pickup_date, order.pickup_time)}
                  </span>
                  <span className="text-sm font-bold text-gray-900">
                    ¥{Number(order.total_amount).toLocaleString()}
                  </span>
                </div>
              </button>
            );
          })}
        </div>
      </div>
    </>
  );

  return (
    <AnimatePresence>
      {open && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 bg-black z-[60]"
            onClick={onClose}
          />

          {isDesktop ? (
            <div className="fixed inset-0 z-[70] flex items-center justify-center p-4" onClick={onClose}>
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.95 }}
                transition={{ duration: 0.2 }}
                onClick={(e) => e.stopPropagation()}
                className="bg-white rounded-2xl shadow-2xl max-h-[85vh] w-full max-w-md flex flex-col overflow-hidden"
              >
                {panelContent}
              </motion.div>
            </div>
          ) : (
            <motion.div
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 30, stiffness: 300 }}
              className="fixed inset-x-0 bottom-0 z-[70] bg-white rounded-t-3xl max-h-[85vh] flex flex-col"
            >
              {panelContent}
            </motion.div>
          )}
        </>
      )}
    </AnimatePresence>
  );
}
