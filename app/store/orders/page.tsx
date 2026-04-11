"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { User, Check } from "lucide-react";
import { useOrders } from "@/hooks/use-orders";
import { useProductTypes } from "@/hooks/use-product-types";
import { useStoreContext } from "@/lib/store-context";
import { useOrderMutations } from "@/hooks/use-order-mutations";
import type { Order } from "@/lib/types";
import { OrderDetailModal } from "@/components/store/order-detail-modal";
import { DatePickerPopup } from "@/components/store/date-picker-popup";

const daysOfWeek = ["日", "月", "火", "水", "木", "金", "土"];

function formatDate(date: Date) {
  const y = date.getFullYear();
  const m = date.getMonth() + 1;
  const d = date.getDate();
  const day = daysOfWeek[date.getDay()];
  return `${y}年${m}月${d}日(${day})`;
}

export default function StoreOrdersPage() {
  const { storeId } = useStoreContext();
  const { orders, loading: ordersLoading, refetch: refetchOrders } = useOrders({ storeId, unpreparedOnly: true });
  const { categories, loading: typesLoading } = useProductTypes();
  const { togglePrepared } = useOrderMutations();

  const [productType, setProductType] = useState("すべて");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [checkedIds, setCheckedIds] = useState<Set<string>>(new Set());
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
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

  const toggleCheck = async (id: string) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    await updateOrderStatus(id, !order.isPrepared);
    setCheckedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
    refetchOrders();
  };

  if (ordersLoading || typesLoading) {
    return (
      <div className="p-6 flex items-center justify-center">
        <p className="text-gray-500">読み込み中...</p>
      </div>
    );
  }

  return (
    <div className="p-6">
      <div className="flex items-center justify-end gap-4 mb-6">
        <select
          value={productType}
          onChange={(e) => setProductType(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-2 text-sm w-[200px]"
        >
          {categories.map((t) => (
            <option key={t} value={t}>{t}</option>
          ))}
        </select>
        <div ref={dateRef} className="relative">
          <button
            onClick={() => setShowDatePicker(!showDatePicker)}
            className="border border-gray-300 rounded-lg px-4 py-2 text-sm text-gray-500 min-w-[200px] text-left hover:border-gray-400 transition-colors"
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

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[40px_1.2fr_1.5fr_1.5fr_50px_1fr] bg-[#FFF176] px-4 py-2.5 text-sm font-bold text-gray-700 items-center">
          <span />
          <span>LINE</span>
          <span>来店時間</span>
          <span>注文内容</span>
          <span />
          <span>合計金額</span>
        </div>

        {orders.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">
            未準備の注文はありません
          </div>
        )}

        {orders.map((order, i) => {
          const isChecked = checkedIds.has(order.id);
          const isDelivery = !!order.address;

          return (
            <motion.div
              key={order.id}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.03 }}
              onClick={() => setSelectedOrder(order)}
              className={`grid grid-cols-[40px_1.2fr_1.5fr_1.5fr_50px_1fr] px-4 py-3 items-center border-t border-gray-100 cursor-pointer transition-colors ${
                isDelivery
                  ? "bg-pink-50 hover:bg-pink-100"
                  : "hover:bg-gray-50"
              }`}
            >
              <div
                onClick={(e) => {
                  e.stopPropagation();
                  toggleCheck(order.id);
                }}
              >
                <div
                  className={`w-6 h-6 rounded border-2 flex items-center justify-center cursor-pointer transition-colors ${
                    isChecked
                      ? "bg-blue-500 border-blue-500"
                      : "border-gray-300 bg-white"
                  }`}
                >
                  {isChecked && <Check className="w-3.5 h-3.5 text-white" />}
                </div>
              </div>

              <div className="flex items-center gap-2">
                <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center shrink-0">
                  <User className="w-4 h-4 text-gray-500" />
                </div>
                <span className="text-sm">{order.lineName}</span>
              </div>

              <div className="text-sm text-gray-600">
                {order.visitTime && <div>{order.visitTime}</div>}
                {isDelivery && (
                  <div className="text-xs text-gray-500 whitespace-pre-line leading-relaxed">
                    {order.address}
                    {order.pickupTimeSlot && (
                      <>
                        {"\n"}受取時間：{order.pickupTimeSlot}
                      </>
                    )}
                  </div>
                )}
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
                  &yen;{order.total.toLocaleString()}
                  {order.shippingIncluded && (
                    <span className="text-xs font-normal">(配送料込)</span>
                  )}
                </div>
                <div
                  className={`text-xs ${
                    order.paymentStatus === "決済済み"
                      ? "text-green-600"
                      : order.paymentStatus === "店頭支払い" || order.paymentStatus === "銀行振込"
                      ? "text-blue-600"
                      : "text-gray-500"
                  }`}
                >
                  {order.paymentStatus}
                </div>
              </div>
            </motion.div>
          );
        })}
      </div>

      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailModal
            order={selectedOrder}
            onClose={() => setSelectedOrder(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
