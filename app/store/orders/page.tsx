"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Loader2 } from "lucide-react";
import { useOrders, type OrderChannel } from "@/hooks/use-orders";
import { useStoreContext } from "@/lib/store-context";
import { useAuth } from "@/lib/auth-context";
import { useOrderMutations } from "@/hooks/use-order-mutations";
import { DatePickerPopup } from "@/components/store/date-picker-popup";

const daysOfWeek = ["日", "月", "火", "水", "木", "金", "土"];

const channelTabs: { label: string; value: "" | OrderChannel }[] = [
  { label: "すべて", value: "" },
  { label: "テイクアウト", value: "takeout" },
  { label: "EC", value: "ec" },
];

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const day = daysOfWeek[date.getDay()];
  return `${y}年${m}月${d}日(${day})`;
}

function formatFulfilledAt(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  const hh = String(d.getHours()).padStart(2, "0");
  const mm = String(d.getMinutes()).padStart(2, "0");
  return `${y}/${m}/${day} ${hh}:${mm}`;
}

type ConfirmAction = {
  orderId: string;
  toFulfilled: boolean;
  isEc: boolean;
};

export default function StoreOrdersPage() {
  const { storeId } = useStoreContext();
  const { user } = useAuth();
  const [channel, setChannel] = useState<"" | OrderChannel>("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const { orders, loading: ordersLoading, refetch: refetchOrders } = useOrders({
    storeId,
    channel: channel || undefined,
    date: selectedDate.toISOString(),
  });
  const { updateFulfillmentStatus } = useOrderMutations();

  const [showDatePicker, setShowDatePicker] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleConfirm = async () => {
    if (!confirmAction || confirmLoading) return;
    setConfirmLoading(true);
    try {
      await updateFulfillmentStatus(
        confirmAction.orderId,
        confirmAction.toFulfilled,
        user?.id ?? null,
      );
      await refetchOrders();
    } finally {
      setConfirmAction(null);
      setConfirmLoading(false);
    }
  };

  if (ordersLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-between gap-4 mb-6">
        <div className="flex gap-2">
          {channelTabs.map((t) => (
            <button
              key={t.label}
              onClick={() => setChannel(t.value)}
              className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
                channel === t.value
                  ? "bg-amber-400 text-white border-amber-400"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-4">
        <div ref={dateRef} className="relative">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-700 min-w-[200px] text-left hover:border-gray-400 transition-colors"
          >
            {formatDate(selectedDate)}
          </button>
          <AnimatePresence>
            {showDatePicker && (
              <DatePickerPopup
                selectedDate={selectedDate}
                onSelect={(date) => {
                  setSelectedDate(date);
                  setShowDatePicker(false);
                }}
                onClear={() => {
                  setSelectedDate(new Date());
                  setShowDatePicker(false);
                }}
                onClose={() => setShowDatePicker(false)}
              />
            )}
          </AnimatePresence>
        </div>
        </div>
      </div>

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[1fr_1fr_1.3fr_1.3fr_50px_1fr_130px] bg-[#FFF176] px-4 py-2.5 text-sm font-bold text-gray-700 items-center">
          <span>区分</span>
          <span>顧客名</span>
          <span>来店/発送</span>
          <span>注文内容</span>
          <span />
          <span>合計金額</span>
          <span className="text-center">提供状況</span>
        </div>

        {orders.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400 bg-white">
            該当する注文はありません
          </div>
        )}

        {orders.map((order, i) => {
          const isEc = order.orderType === "ec";
          const isFulfilled = order.fulfillmentStatus === "fulfilled";
          const fulfilledLabel = isEc ? "出荷済" : "受渡済";

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              className={`grid grid-cols-[1fr_1fr_1.3fr_1.3fr_50px_1fr_130px] px-4 py-3 items-center border-t border-gray-100 ${
                isFulfilled ? "bg-white" : isEc ? "bg-blue-50" : "bg-amber-50/40"
              }`}
            >
              <div>
                <span
                  className={`inline-block text-xs font-bold px-2 py-0.5 rounded ${
                    isEc ? "bg-blue-500 text-white" : "bg-amber-500 text-white"
                  }`}
                >
                  {isEc ? "EC" : "テイクアウト"}
                </span>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-gray-500" />
                </div>
                <span className="text-sm">{order.customerName || "-"}</span>
              </div>

              <div className="text-sm text-gray-600">
                {order.pickupTime && <div>{order.pickupTime.slice(0, 5)}</div>}
                {order.pickupDate && <div className="text-xs text-gray-500">{order.pickupDate}</div>}
              </div>

              <div className="text-sm">
                {order.items.map((item, j) => (
                  <div key={j}>{item.name}</div>
                ))}
              </div>

              <div className="text-sm text-gray-500">
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

              <div className="flex flex-col items-center gap-1">
                <motion.button
                  whileHover={{ scale: 1.04 }}
                  whileTap={{ scale: 0.96 }}
                  onClick={() =>
                    setConfirmAction({
                      orderId: order.id,
                      toFulfilled: !isFulfilled,
                      isEc,
                    })
                  }
                  className={`min-w-[100px] text-xs font-bold px-3 py-2 rounded-lg transition-colors ${
                    isFulfilled
                      ? "bg-green-500 hover:bg-green-600 text-white"
                      : "bg-gray-200 hover:bg-gray-300 text-gray-700"
                  }`}
                >
                  {isFulfilled ? fulfilledLabel : "未提供"}
                </motion.button>
                {isFulfilled && order.fulfilledAt && (
                  <span className="text-[10px] text-gray-500">
                    {formatFulfilledAt(order.fulfilledAt)}
                  </span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>

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
              <h3 className="text-base font-bold text-center mb-2">
                {confirmAction.toFulfilled
                  ? confirmAction.isEc
                    ? "出荷済にします"
                    : "受渡済にします"
                  : "未提供に戻す"}
              </h3>
              <p className="text-xs text-gray-500 text-center mb-5">
                {confirmAction.toFulfilled
                  ? "この注文を提供済にしますか？提供日時が記録されます。"
                  : "この注文を未提供に戻しますか？"}
              </p>
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
                    confirmAction.toFulfilled
                      ? "bg-green-500 hover:bg-green-600"
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
