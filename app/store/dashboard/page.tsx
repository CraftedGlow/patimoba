"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  Users,
  Building2,
} from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import { WholeCakeDetailModal } from "@/components/store/whole-cake-detail-modal";
import { OrderDetailModal } from "@/components/store/order-detail-modal";
import type { Order } from "@/lib/types";
import { useOrders } from "@/hooks/use-orders";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useStoreContext } from "@/lib/store-context";
import { DatePickerPopup } from "@/components/store/date-picker-popup";
import { useOrderMutations } from "@/hooks/use-order-mutations";
import { supabase } from "@/lib/supabase";

const dayNames = ["日", "月", "火", "水", "木", "金", "土"];
const INACTIVITY_MS = 3 * 60 * 1000; // 3分

type ConfirmAction = {
  orderId: string;
  toReady: boolean;
  isEc: boolean;
};


export default function StoreDashboardPage() {
  const { storeId, isMaster, childStores } = useStoreContext();
  const [selectedChildId, setSelectedChildId] = useState<string | null>(null);
  const [selectedDate, setSelectedDate] = useState(new Date());
  const defaultDate = useRef(new Date());
  const pickupDateStr = `${selectedDate.getFullYear()}-${String(selectedDate.getMonth() + 1).padStart(2, "0")}-${String(selectedDate.getDate()).padStart(2, "0")}`;

  // When master: storeIds drives queries; otherwise storeId as before
  const activeStoreId = isMaster ? selectedChildId ?? undefined : storeId;
  const activeStoreIds = isMaster && selectedChildId === null
    ? childStores.map((s) => s.id)
    : undefined;

  const { orders: takeoutOrders, loading: takeoutLoading, refetch: refetchTakeout } = useOrders({
    storeId: activeStoreId,
    storeIds: activeStoreIds,
    pickupDate: pickupDateStr,
    channel: "takeout",
  });
  const { orders: ecOrders, loading: ecLoading, refetch: refetchEc } = useOrders({
    storeId: activeStoreId,
    storeIds: activeStoreIds,
    channel: "ec",
    fulfillmentStatus: "pending",
  });
  const ordersLoading = takeoutLoading || ecLoading;
  const orders = [...takeoutOrders, ...ecOrders];
  const refetchOrders = async () => { await Promise.all([refetchTakeout(), refetchEc()]); };
  const { stats, loading: statsLoading, refetch: refetchStats } = useDashboardStats(activeStoreIds ?? activeStoreId ?? storeId);

  // Child store name lookup for badge display in all-stores view
  const childStoreMap = Object.fromEntries(childStores.map((s) => [s.id, s.name]));
  const { updateOrderStatus, updateFulfillmentStatus } = useOrderMutations();

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [wholeCakeDetailOrder, setWholeCakeDetailOrder] = useState<Order | null>(null);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const dateRef = useRef<HTMLDivElement>(null);
  const inactivityTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const dateStr = `${selectedDate.getFullYear()}年${
    selectedDate.getMonth() + 1
  }月${selectedDate.getDate()}日(${dayNames[selectedDate.getDay()]})`;

  // 不活動タイムアウト：一定時間操作なしでデフォルト（今日）に戻る
  const resetInactivityTimer = useCallback(() => {
    if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    inactivityTimerRef.current = setTimeout(() => {
      const today = new Date();
      defaultDate.current = today;
      setSelectedDate(today);
    }, INACTIVITY_MS);
  }, []);

  useEffect(() => {
    const events = ["mousemove", "keydown", "touchstart", "click"];
    events.forEach((e) => document.addEventListener(e, resetInactivityTimer));
    resetInactivityTimer();
    return () => {
      events.forEach((e) => document.removeEventListener(e, resetInactivityTimer));
      if (inactivityTimerRef.current) clearTimeout(inactivityTimerRef.current);
    };
  }, [resetInactivityTimer]);

  // Supabaseリアルタイム：データ再取得（通知はlayoutのNewOrderAlertが担当）
  useEffect(() => {
    if (!storeId) return;
    const watchIds = isMaster
      ? (selectedChildId ? [selectedChildId] : childStores.map((s) => s.id))
      : [storeId];
    if (watchIds.length === 0) return;

    const channels = watchIds.map((id) =>
      supabase
        .channel(`dashboard-orders-${id}`)
        .on(
          "postgres_changes",
          { event: "INSERT", schema: "public", table: "orders", filter: `store_id=eq.${id}` },
          () => { refetchOrders(); refetchStats(); }
        )
        .subscribe()
    );

    return () => {
      channels.forEach((ch) => supabase.removeChannel(ch));
    };
  }, [storeId, isMaster, selectedChildId, childStores.map((s) => s.id).join(",")]);

  const handleConfirm = async () => {
    if (!confirmAction || confirmLoading) return;
    setConfirmLoading(true);
    try {
      if (confirmAction.isEc) {
        await updateFulfillmentStatus(confirmAction.orderId, confirmAction.toReady, null);
        if (confirmAction.toReady) {
          await fetch("/api/line/send-ship-notification", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ orderId: confirmAction.orderId }),
          }).catch(() => {});
        }
      } else {
        await updateOrderStatus(confirmAction.orderId, confirmAction.toReady ? "ready" : "pending");
      }
      await refetchOrders();
    } finally {
      setConfirmAction(null);
      setConfirmLoading(false);
    }
  };

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const todaySales = orders.reduce((sum, o) => sum + o.totalAmount, 0);
  const todayOrders = orders.length;

  const now = new Date();
  const nowMinutes = now.getHours() * 60 + now.getMinutes();
  const parsePickupMinutes = (t: string | null | undefined): number => {
    if (!t) return Infinity;
    const [h, m] = t.split(":").map(Number);
    return (h || 0) * 60 + (m || 0);
  };
  const sortedOrders = [...orders].sort((a, b) => {
    const ta = parsePickupMinutes(a.pickupTime);
    const tb = parsePickupMinutes(b.pickupTime);
    const aFuture = ta >= nowMinutes;
    const bFuture = tb >= nowMinutes;
    if (aFuture && !bFuture) return -1;
    if (!aFuture && bFuture) return 1;
    return ta - tb;
  });

  if (ordersLoading || statsLoading) {
    return (
      <div className="p-4 lg:p-6 flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6">
      {isMaster && childStores.length > 0 && (
        <div className="flex flex-wrap gap-2 mb-5">
          <button
            onClick={() => setSelectedChildId(null)}
            className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
              selectedChildId === null
                ? "bg-amber-400 text-white"
                : "bg-gray-100 text-gray-600 hover:bg-gray-200"
            }`}
          >
            全店舗
          </button>
          {childStores.map((s) => (
            <button
              key={s.id}
              onClick={() => setSelectedChildId(s.id)}
              className={`px-4 py-1.5 rounded-full text-sm font-medium transition-colors ${
                selectedChildId === s.id
                  ? "bg-amber-400 text-white"
                  : "bg-gray-100 text-gray-600 hover:bg-gray-200"
              }`}
            >
              {s.name}
            </button>
          ))}
        </div>
      )}

      <div className="flex justify-end mb-6" ref={dateRef}>
        <div className="relative">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
          >
            {dateStr}
          </button>
          <AnimatePresence>
            {showDatePicker && (
              <DatePickerPopup
                selectedDate={selectedDate}
                onSelect={(date) => {
                  setSelectedDate(date);
                  setShowDatePicker(false);
                }}
                onClear={() => setSelectedDate(new Date())}
                onClose={() => setShowDatePicker(false)}
              />
            )}
          </AnimatePresence>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4 mb-8">
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-1">
            <DollarSign className="w-4 h-4 text-amber-500" />
            本日の売上速報
          </div>
          <p className="text-2xl font-bold">
            &yen;{todaySales.toLocaleString()}
          </p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-1">
            <Users className="w-4 h-4 text-amber-500" />
            今日の注文件数
          </div>
          <p className="text-2xl font-bold">{todayOrders}件</p>
        </motion.div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="text-center"
        >
          <div className="flex items-center justify-center gap-2 text-sm text-gray-500 mb-1">
            <Building2 className="w-4 h-4 text-amber-500" />
            今月の総売上
          </div>
          <p className="text-2xl font-bold">
            &yen;{stats.monthlySales.toLocaleString()}
          </p>
        </motion.div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        {/* デスクトップ用ヘッダー */}
        <div className="hidden lg:grid grid-cols-[130px_140px_minmax(0,1fr)_100px_64px] bg-[#FFF176] px-3 py-2.5 text-xs font-bold text-gray-700 items-center">
          <span>顧客名</span>
          <span>来店/発送</span>
          <span className="pl-3">注文内容</span>
          <span>合計金額</span>
          <span className="text-center">確認済</span>
        </div>

        {sortedOrders.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-600 bg-white">
            表示する注文はありません
          </div>
        ) : (
          sortedOrders.map((order, i) => {
            const isEc = order.orderType === "ec";
            const orderStoreName = isMaster && selectedChildId === null
              ? (childStoreMap[order.storeId] ?? "")
              : null;
            const isCancelled = order.orderStatus === "cancelled";
            const isPrepared = isEc
              ? order.fulfillmentStatus === "fulfilled"
              : order.orderStatus === "ready" || order.orderStatus === "completed" || order.fulfillmentStatus === "fulfilled";

            const readyButton = (
              <motion.button
                whileHover={{ scale: 1.08 }}
                whileTap={{ scale: 0.92 }}
                onClick={(e) => {
                  e.stopPropagation();
                  setConfirmAction({ orderId: order.id, toReady: !isPrepared, isEc });
                }}
                className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                  isPrepared
                    ? "bg-amber-400 hover:bg-amber-500 text-white"
                    : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                }`}
              >
                {isPrepared ? "済" : "未"}
              </motion.button>
            );

            return (
              <motion.div
                key={order.id}
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                exit={{ opacity: 0, x: 10 }}
                transition={{ delay: i * 0.05 }}
                onClick={() => setSelectedOrder(order)}
                className="cursor-pointer"
              >
                {/* モバイル用カード */}
                <div
                  className={`lg:hidden rounded-lg border p-3 mb-2 mx-2 mt-2 ${
                    isCancelled
                      ? "bg-red-50 border-red-200"
                      : isEc
                      ? "bg-amber-50 border-gray-100"
                      : "bg-white border-gray-100"
                  }`}
                >
                  <div className="flex items-start justify-between gap-2">
                    {/* 左: 顧客名 + 来店時間/配送先 */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <p className="text-sm font-bold text-gray-900 truncate">
                          {order.customerName || order.lineName || "-"}
                        </p>
                        {orderStoreName && (
                          <span className="shrink-0 text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium">
                            {orderStoreName}
                          </span>
                        )}
                      </div>
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">
                        {isEc
                          ? (order.notes?.split("　配送時間")[0] || "-")
                          : (order.pickupTime ? order.pickupTime.slice(0, 5) : "-")}
                      </p>
                      {/* 注文商品リスト */}
                      <div className="mt-1.5">
                        {order.items.map((item, j) => (
                          <div key={j} className="flex items-center gap-1.5 text-sm">
                            <span className="truncate">{item.name}</span>
                            {item.variantName ? (
                              <button
                                onClick={(e) => { e.stopPropagation(); setWholeCakeDetailOrder(order); }}
                                className="shrink-0 bg-amber-400 hover:bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors"
                              >
                                詳細
                              </button>
                            ) : (
                              <span className="shrink-0 text-gray-600 text-xs">×{item.quantity}</span>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>

                    {/* 右: 金額 + 支払状況 + 準備ボタン */}
                    <div className="flex flex-col items-end gap-2 shrink-0">
                      <div className="text-right">
                        <div className="text-sm font-bold">
                          &yen;{order.totalAmount.toLocaleString()}
                        </div>
                        <div
                          className={`text-xs ${
                            order.paymentStatus === "決済済み"
                              ? "text-green-600"
                              : order.paymentStatus === "店頭支払い" ||
                                  order.paymentStatus === "銀行振込"
                                ? "text-blue-600"
                                : "text-gray-500"
                          }`}
                        >
                          {order.paymentStatus}
                        </div>
                      </div>
                      {readyButton}
                    </div>
                  </div>
                </div>

                {/* デスクトップ用グリッド行 */}
                <div
                  className={`hidden lg:grid grid-cols-[130px_140px_minmax(0,1fr)_100px_64px] px-3 py-3 items-center border-t border-gray-100 ${
                    isCancelled
                      ? "bg-red-50 hover:bg-red-100"
                      : isEc
                      ? "bg-amber-50 hover:bg-amber-100"
                      : "bg-white hover:bg-gray-50"
                  }`}
                >
                  <div>
                    <span className="text-xs text-gray-900">{order.customerName || order.lineName || "-"}</span>
                    {orderStoreName && (
                      <div className="text-[10px] bg-blue-100 text-blue-700 px-1.5 py-0.5 rounded font-medium mt-0.5 inline-block">
                        {orderStoreName}
                      </div>
                    )}
                  </div>

                  <div className="text-xs text-gray-600">
                    {isEc
                      ? <span className="text-[10px] leading-tight line-clamp-2">{order.notes?.split("　配送時間")[0] || "-"}</span>
                      : (order.pickupTime ? order.pickupTime.slice(0, 5) : "-")}
                  </div>

                  <div className="text-sm min-w-0 pl-3 pt-1">
                    {order.items.map((item, j) => (
                      <div key={j} className="flex items-center gap-1.5 truncate">
                        <span className="truncate">{item.name}</span>
                        {item.variantName ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setWholeCakeDetailOrder(order); }}
                            className="shrink-0 bg-amber-400 hover:bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors"
                          >
                            詳細
                          </button>
                        ) : (
                          <span className="shrink-0 text-gray-600 text-xs">×{item.quantity}</span>
                        )}
                      </div>
                    ))}
                  </div>

                  <div>
                    <div className="text-sm font-bold">
                      &yen;{order.totalAmount.toLocaleString()}
                    </div>
                    <div
                      className={`text-xs ${
                        order.paymentStatus === "決済済み"
                          ? "text-green-600"
                          : order.paymentStatus === "店頭支払い" ||
                              order.paymentStatus === "銀行振込"
                            ? "text-blue-600"
                            : "text-gray-500"
                      }`}
                    >
                      {order.paymentStatus}
                    </div>
                  </div>

                  <div className="flex justify-center">
                    {readyButton}
                  </div>
                </div>
              </motion.div>
            );
          })
        )}
      </div>

      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} onConfirmed={refetchOrders} />
        )}
      </AnimatePresence>

      <AnimatePresence>
        {wholeCakeDetailOrder && (
          <WholeCakeDetailModal
            order={wholeCakeDetailOrder}
            onClose={() => setWholeCakeDetailOrder(null)}
          />
        )}
      </AnimatePresence>

      {/* 準備状況変更確認ポップアップ */}
      <AnimatePresence>
        {confirmAction && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-50"
              onClick={() => !confirmLoading && setConfirmAction(null)}
            />
            <div className="fixed inset-0 flex items-center justify-center z-[60] pointer-events-none">
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18 }}
              className="bg-white rounded-2xl shadow-2xl p-6 w-[90%] max-w-sm pointer-events-auto"
            >
              {confirmAction.isEc && confirmAction.toReady ? (
                <>
                  <h3 className="text-base font-bold text-center mb-2">
                    商品を発送しましたか？
                  </h3>
                  <p className="text-xs text-gray-500 text-center mb-5">
                    「はい」を押すと顧客に発送通知が送信されます
                  </p>
                </>
              ) : (
                <>
                  <h3 className="text-base font-bold text-center mb-2">
                    {confirmAction.toReady ? "確認完了にします" : "確認済を解除します"}
                  </h3>
                  <p className="text-xs text-gray-500 text-center mb-5">
                    {confirmAction.toReady
                      ? "この注文を確認完了にしますか？"
                      : "確認済を解除しますか？"}
                  </p>
                </>
              )}
              <div className="flex gap-3">
                <button
                  type="button"
                  disabled={confirmLoading}
                  onClick={() => setConfirmAction(null)}
                  className="flex-1 border-2 border-gray-300 text-gray-700 font-bold py-2.5 rounded-full text-sm hover:bg-gray-50 transition-colors disabled:opacity-60"
                >
                  キャンセル
                </button>
                <button
                  type="button"
                  disabled={confirmLoading}
                  onClick={handleConfirm}
                  className={`flex-1 font-bold py-2.5 rounded-full text-sm flex items-center justify-center gap-1 disabled:opacity-60 text-white ${
                    confirmAction.toReady
                      ? "bg-amber-400 hover:bg-amber-500"
                      : "bg-gray-500 hover:bg-gray-600"
                  }`}
                >
                  {confirmLoading && (
                    <LineSpinner size={16} />
                  )}
                  はい
                </button>
              </div>
            </motion.div>
            </div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
