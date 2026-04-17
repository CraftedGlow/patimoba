"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  Users,
  Building2,
  User,
  Loader2,
  Bell,
} from "lucide-react";
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

function playNotificationSound() {
  try {
    const ctx = new (window.AudioContext || (window as any).webkitAudioContext)();
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();
    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime);
    oscillator.frequency.setValueAtTime(660, ctx.currentTime + 0.1);
    oscillator.frequency.setValueAtTime(880, ctx.currentTime + 0.2);
    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5);
    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.5);
  } catch {
    // ブラウザが未対応の場合は無視
  }
}

export default function StoreDashboardPage() {
  const { storeId } = useStoreContext();
  const [selectedDate, setSelectedDate] = useState(new Date());
  const defaultDate = useRef(new Date());
  const { orders, loading: ordersLoading, refetch: refetchOrders } = useOrders({
    storeId,
    date: selectedDate.toISOString(),
  });
  const { stats, loading: statsLoading } = useDashboardStats(storeId);
  const { updateOrderStatus } = useOrderMutations();

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const [newOrderAlert, setNewOrderAlert] = useState(false);
  const audioLoopRef = useRef<ReturnType<typeof setInterval> | null>(null);
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

  // Supabaseリアルタイム：新規注文通知
  useEffect(() => {
    if (!storeId) return;
    const channel = supabase
      .channel(`new-orders-${storeId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "orders",
          filter: `store_id=eq.${storeId}`,
        },
        () => {
          setNewOrderAlert(true);
          refetchOrders();
          // 音声ループ開始
          playNotificationSound();
          if (!audioLoopRef.current) {
            audioLoopRef.current = setInterval(() => {
              playNotificationSound();
            }, 2000);
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
      if (audioLoopRef.current) {
        clearInterval(audioLoopRef.current);
        audioLoopRef.current = null;
      }
    };
  }, [storeId]);

  const dismissNewOrderAlert = () => {
    setNewOrderAlert(false);
    if (audioLoopRef.current) {
      clearInterval(audioLoopRef.current);
      audioLoopRef.current = null;
    }
  };

  const handleConfirm = async () => {
    if (!confirmAction || confirmLoading) return;
    setConfirmLoading(true);
    try {
      await updateOrderStatus(
        confirmAction.orderId,
        confirmAction.toReady ? "ready" : "pending"
      );
      // 配送ECで発送完了にする場合、通知APIを呼ぶ
      if (confirmAction.isEc && confirmAction.toReady) {
        await fetch("/api/line/send-ship-notification", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ orderId: confirmAction.orderId }),
        }).catch(() => {
          // 通知失敗しても続行
        });
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

  if (ordersLoading || statsLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
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
            &yen;{stats.todaySales.toLocaleString()}
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
          <p className="text-2xl font-bold">{stats.todayOrders}件</p>
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

      <div className="overflow-x-auto">
      <div className="min-w-[640px] border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1.5fr_auto_1fr_80px] bg-[#FFF176] px-4 py-2.5 text-sm font-bold text-gray-700 items-center">
          <span>顧客名</span>
          <span>来店時間</span>
          <span>注文内容</span>
          <span />
          <span>合計金額</span>
          <span className="text-center">準備</span>
        </div>

        {orders.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-gray-400 bg-white">
            表示する注文はありません
          </div>
        ) : (
          orders.map((order, i) => {
            const isPrepared =
              order.orderStatus === "ready" || order.orderStatus === "completed";
            const isEc = order.orderType === "ec";

            return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: 10 }}
              transition={{ delay: i * 0.05 }}
              className={`grid grid-cols-[1fr_1fr_1.5fr_auto_1fr_80px] px-4 py-3 items-center border-t border-gray-100 ${
                isEc ? "bg-red-50" : "bg-white"
              }`}
            >
              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                  <User className="w-4 h-4 text-gray-500" />
                </div>
                <span className="text-sm">{order.customerName || "-"}</span>
              </div>

              <div className="text-sm text-gray-600">
                {order.pickupTime ? (
                  <div>{order.pickupTime.slice(0, 5)}</div>
                ) : (
                  "-"
                )}
              </div>

              <div className="text-sm">
                {order.items.map((item, j) => (
                  <div key={j}>{item.name}</div>
                ))}
              </div>

              <div className="text-sm text-gray-500 px-2">
                {order.items.map((item, j) => (
                  <div key={j}>&times;{item.quantity}</div>
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
                <motion.button
                  whileHover={{ scale: 1.08 }}
                  whileTap={{ scale: 0.92 }}
                  onClick={() =>
                    setConfirmAction({
                      orderId: order.id,
                      toReady: !isPrepared,
                      isEc,
                    })
                  }
                  className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${
                    isPrepared
                      ? "bg-amber-400 hover:bg-amber-500 text-white"
                      : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                  }`}
                >
                  {isPrepared ? "済" : "未"}
                </motion.button>
              </div>
            </motion.div>
            );
          })
        )}
      </div>
      </div>

      {/* 新規注文通知ポップアップ */}
      <AnimatePresence>
        {newOrderAlert && (
          <>
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 0.4 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-black z-50"
            />
            <motion.div
              initial={{ opacity: 0, scale: 0.85 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.85 }}
              transition={{ type: "spring", damping: 20, stiffness: 300 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-[60] p-8 w-[90%] max-w-sm text-center"
            >
              <div className="w-16 h-16 rounded-full bg-amber-100 flex items-center justify-center mx-auto mb-4">
                <Bell className="w-8 h-8 text-amber-500" />
              </div>
              <h3 className="text-xl font-bold mb-2">新規注文が入りました</h3>
              <p className="text-sm text-gray-500 mb-6">
                新しい注文を確認してください
              </p>
              <button
                type="button"
                onClick={dismissNewOrderAlert}
                className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-3 rounded-full text-base transition-colors"
              >
                確認する
              </button>
            </motion.div>
          </>
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
            <motion.div
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.18 }}
              className="fixed left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2 bg-white rounded-2xl shadow-2xl z-[60] p-6 w-[90%] max-w-sm"
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
                    {confirmAction.toReady ? "準備完了にします" : "準備未完了に戻す"}
                  </h3>
                  <p className="text-xs text-gray-500 text-center mb-5">
                    {confirmAction.toReady
                      ? "この注文を準備完了にしますか？"
                      : "この注文を未準備に戻しますか？"}
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
                    <Loader2 className="w-4 h-4 animate-spin" />
                  )}
                  はい
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>
    </div>
  );
}
