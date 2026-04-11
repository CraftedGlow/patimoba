"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DollarSign,
  Users,
  Building2,
  User,
  Check,
  ChevronLeft,
  ChevronRight,
  X,
  Bluetooth,
} from "lucide-react";
import { useOrders } from "@/hooks/use-orders";
import { useDashboardStats } from "@/hooks/use-dashboard-stats";
import { useStoreContext } from "@/lib/store-context";
import { OrderDetailModal } from "@/components/store/order-detail-modal";
import { DatePickerPopup } from "@/components/store/date-picker-popup";
import { useOrderMutations } from "@/hooks/use-order-mutations";
import type { Order } from "@/lib/types";

const dayNames = ["日", "月", "火", "水", "木", "金", "土"];

export default function StoreDashboardPage() {
  const { storeId } = useStoreContext();
  const { orders, loading: ordersLoading, refetch: refetchOrders } = useOrders({ storeId });
  const { stats, loading: statsLoading } = useDashboardStats(storeId);
  const { togglePrepared } = useOrderMutations();

  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [modalOrder, setModalOrder] = useState<Order | null>(null);
  const dateRef = useRef<HTMLDivElement>(null);

  const dateStr = `${selectedDate.getFullYear()}年${selectedDate.getMonth() + 1}月${selectedDate.getDate()}日(${dayNames[selectedDate.getDay()]})`;

  const handleTogglePrepared = async (id: string) => {
    const order = orders.find((o) => o.id === id);
    if (!order) return;
    const newPrepared = !order.isPrepared;
    await togglePrepared(id, newPrepared);
    if (newPrepared) {
      setModalOrder({ ...order, isPrepared: newPrepared });
    }
    refetchOrders();
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

      <div className="grid grid-cols-3 gap-6 mb-8">
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

      <div className="border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[40px_1fr_1fr_1.5fr_auto_1fr_80px] bg-[#FFF176] px-4 py-2.5 text-sm font-bold text-gray-700 items-center">
          <span />
          <span>LINE</span>
          <span>来店時間</span>
          <span>注文内容</span>
          <span />
          <span>合計金額</span>
          <span className="text-center">準備</span>
        </div>

        {orders.map((order, i) => (
          <motion.div
            key={order.id}
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            transition={{ delay: i * 0.1 }}
            className={`grid grid-cols-[40px_1fr_1fr_1.5fr_auto_1fr_80px] px-4 py-3 items-center border-t border-gray-100 ${
              !order.isPrepared ? "bg-pink-50" : "bg-white"
            }`}
          >
            <div>
              <button
                onClick={() => handleTogglePrepared(order.id)}
                className={`w-6 h-6 rounded border-2 flex items-center justify-center transition-colors ${
                  order.isPrepared
                    ? "bg-blue-500 border-blue-500"
                    : "border-gray-300 bg-white"
                }`}
              >
                {order.isPrepared && (
                  <Check className="w-3.5 h-3.5 text-white" />
                )}
              </button>
            </div>

            <div className="flex items-center gap-2">
              <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center">
                <User className="w-4 h-4 text-gray-500" />
              </div>
              <span className="text-sm">{order.customerName}</span>
            </div>

            <div className="text-sm text-gray-600">
              {order.visitTime}
              {order.address && (
                <div className="text-xs text-gray-400 mt-0.5 line-clamp-2">
                  {order.address}
                  {order.pickupTimeSlot && (
                    <>
                      <br />
                      受取時間：{order.pickupTimeSlot}
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

            <div className="text-sm text-gray-500 px-2">
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
                    : "text-blue-600"
                }`}
              >
                {order.paymentStatus}
              </div>
            </div>

            <div className="flex justify-center">
              <div
                className={`w-9 h-9 rounded-full flex items-center justify-center text-xs font-bold ${
                  order.isPrepared
                    ? "bg-amber-400 text-white"
                    : "bg-gray-200 text-gray-500"
                }`}
              >
                {order.isPrepared ? "済" : "未"}
              </div>
            </div>
          </motion.div>
        ))}
      </div>

      <AnimatePresence>
        {modalOrder && (
          <OrderDetailModal
            order={modalOrder}
            onClose={() => setModalOrder(null)}
          />
        )}
      </AnimatePresence>
    </div>
  );
}
