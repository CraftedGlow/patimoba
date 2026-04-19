"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download } from "lucide-react";
import { WholeCakeDetailModal } from "@/components/store/whole-cake-detail-modal";
import { useOrders, type OrderChannel } from "@/hooks/use-orders";
import { useStoreContext } from "@/lib/store-context";
import type { Order } from "@/lib/types";
import { OrderDetailModal } from "@/components/store/order-detail-modal";
import { DatePickerPopup } from "@/components/store/date-picker-popup";

const daysOfWeek = ["日", "月", "火", "水", "木", "金", "土"];

const channelTabs: { label: string; value: "" | OrderChannel }[] = [
  { label: "すべて", value: "" },
  { label: "テイクアウト", value: "takeout" },
  { label: "EC", value: "ec" },
];

const fulfillmentTabs: { label: string; value: "" | "pending" | "fulfilled" }[] = [
  { label: "すべて", value: "" },
  { label: "未提供", value: "pending" },
  { label: "提供済", value: "fulfilled" },
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

function toISODate(date: Date, endOfDay = false) {
  const d = new Date(date);
  if (endOfDay) d.setHours(23, 59, 59, 999);
  else d.setHours(0, 0, 0, 0);
  return d.toISOString();
}

function yyyymmdd(date: Date) {
  const y = date.getFullYear();
  const m = String(date.getMonth() + 1).padStart(2, "0");
  const d = String(date.getDate()).padStart(2, "0");
  return `${y}${m}${d}`;
}

function csvEscape(v: string | number | null | undefined): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (/[",\n\r]/.test(s)) return `"${s.replace(/"/g, '""')}"`;
  return s;
}

function buildCSV(orders: Order[]): string {
  const header = [
    "注文番号",
    "注文日時",
    "受取日",
    "受取時間",
    "区分",
    "顧客名",
    "商品明細",
    "数量合計",
    "小計",
    "値引",
    "合計",
    "支払状況",
    "注文状態",
    "提供状況",
    "提供日時",
    "備考",
  ];
  const rows = orders.map((o) => {
    const isEc = o.orderType === "ec";
    const itemsStr = o.items.map((i) => `${i.name}x${i.quantity}`).join(" / ");
    const qtySum = o.items.reduce((s, i) => s + i.quantity, 0);
    return [
      o.orderNo || o.id,
      o.createdAt,
      o.pickupDate,
      o.pickupTime,
      isEc ? "EC" : "テイクアウト",
      o.customerName || o.lineName,
      itemsStr,
      qtySum,
      o.subtotal,
      o.discountAmount,
      o.totalAmount,
      o.paymentStatus,
      o.statusLabel,
      o.fulfillmentStatus === "fulfilled" ? (isEc ? "出荷済" : "受渡済") : "未提供",
      formatFulfilledAt(o.fulfilledAt),
      o.notes || "",
    ].map(csvEscape).join(",");
  });
  return [header.join(","), ...rows].join("\r\n");
}

function downloadCSV(filename: string, csv: string) {
  const bom = "\uFEFF";
  const blob = new Blob([bom + csv], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

export default function StoreOrderHistoryPage() {
  const { storeId, storeName } = useStoreContext();

  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setFullYear(today.getFullYear() - 1);

  const [fromDate, setFromDate] = useState<Date>(defaultFrom);
  const [toDate, setToDate] = useState<Date>(today);
  const [channel, setChannel] = useState<"" | OrderChannel>("");
  const [fulfillment, setFulfillment] = useState<"" | "pending" | "fulfilled">("");

  const { orders, loading: ordersLoading } = useOrders({
    storeId,
    from: toISODate(fromDate),
    to: toISODate(toDate, true),
    channel: channel || undefined,
    fulfillmentStatus: fulfillment || undefined,
  });

  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [wholeCakeDetailOrder, setWholeCakeDetailOrder] = useState<Order | null>(null);
  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (fromRef.current && !fromRef.current.contains(e.target as Node)) {
        setShowFromPicker(false);
      }
      if (toRef.current && !toRef.current.contains(e.target as Node)) {
        setShowToPicker(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const handleExportCSV = () => {
    if (orders.length === 0) {
      alert("エクスポートする注文がありません");
      return;
    }
    const slug = (storeName || "store").replace(/\s+/g, "_");
    const filename = `orders_${slug}_${yyyymmdd(fromDate)}_${yyyymmdd(toDate)}.csv`;
    downloadCSV(filename, buildCSV(orders));
  };

  return (
    <div className="p-6">
      <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
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
        <button
          onClick={handleExportCSV}
          className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors"
        >
          <Download className="w-4 h-4" />
          CSVダウンロード
        </button>
      </div>

      <div className="flex flex-wrap items-center gap-3 mb-6">
        <div className="flex gap-1">
          {fulfillmentTabs.map((t) => (
            <button
              key={t.label}
              onClick={() => setFulfillment(t.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                fulfillment === t.value
                  ? "bg-gray-800 text-white border-gray-800"
                  : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
        <div className="flex items-center gap-2 ml-auto">
          <span className="text-xs text-gray-500">期間</span>
          <div ref={fromRef} className="relative">
            <button
              onClick={() => setShowFromPicker(!showFromPicker)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 min-w-[180px] text-left hover:border-gray-400"
            >
              {formatDate(fromDate)}
            </button>
            <AnimatePresence>
              {showFromPicker && (
                <DatePickerPopup
                  selectedDate={fromDate}
                  onSelect={(d) => { setFromDate(d); setShowFromPicker(false); }}
                  onClear={() => { setFromDate(defaultFrom); setShowFromPicker(false); }}
                  onClose={() => setShowFromPicker(false)}
                />
              )}
            </AnimatePresence>
          </div>
          <span className="text-xs text-gray-500">〜</span>
          <div ref={toRef} className="relative">
            <button
              onClick={() => setShowToPicker(!showToPicker)}
              className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 min-w-[180px] text-left hover:border-gray-400"
            >
              {formatDate(toDate)}
            </button>
            <AnimatePresence>
              {showToPicker && (
                <DatePickerPopup
                  selectedDate={toDate}
                  onSelect={(d) => { setToDate(d); setShowToPicker(false); }}
                  onClear={() => { setToDate(new Date()); setShowToPicker(false); }}
                  onClose={() => setShowToPicker(false)}
                />
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>

      <div className="overflow-x-auto">
      <div className="min-w-[760px] border border-gray-200 rounded-lg overflow-hidden">
        <div className="grid grid-cols-[180px_170px_minmax(260px,2fr)_150px_160px] bg-[#FFF176] pl-1 pr-4 py-3 text-xs font-bold text-gray-700 items-center">
          <span className="pl-3">顧客名</span>
          <span>受取/発送</span>
          <span>注文内容</span>
          <span>合計金額</span>
          <span className="text-center">提供状況</span>
        </div>

        {ordersLoading && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">読み込み中...</div>
        )}

        {!ordersLoading && orders.length === 0 && (
          <div className="px-4 py-8 text-center text-sm text-gray-400">注文履歴はありません</div>
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
              transition={{ delay: i * 0.02 }}
              className={`grid grid-cols-[180px_170px_minmax(260px,2fr)_150px_160px] pr-4 py-4 items-center border-t border-gray-100 border-l-4 cursor-pointer transition-colors ${
                isFulfilled
                  ? "bg-gray-50 border-l-gray-300 hover:bg-gray-100"
                  : isEc
                  ? "bg-sky-50 border-l-sky-400 hover:bg-sky-100"
                  : "bg-amber-50 border-l-amber-400 hover:bg-amber-100"
              }`}
              onClick={() => setSelectedOrder(order)}
            >
              <div className="flex items-center pl-3">
                <span className="text-xs">{order.customerName || order.lineName || "-"}</span>
              </div>

              <div className="text-sm text-gray-700">
                {order.pickupDate && <div className="font-medium">{order.pickupDate}</div>}
                {order.pickupTime && <div className="text-xs text-gray-500">{order.pickupTime.slice(0, 5)}</div>}
              </div>

              <div className="text-sm leading-relaxed">
                {order.hasWholeCake ? (
                  <button
                    onClick={(e) => { e.stopPropagation(); setWholeCakeDetailOrder(order); }}
                    className="inline-flex items-center gap-1 bg-amber-400 hover:bg-amber-500 text-white text-xs font-bold px-2.5 py-1 rounded transition-colors"
                  >
                    詳細
                  </button>
                ) : order.items.map((item, j) => (
                  <div key={j}>
                    {item.name} <span className="text-gray-500">×{item.quantity}</span>
                  </div>
                ))}
              </div>

              <div>
                <div className="text-sm font-bold">¥{order.totalAmount.toLocaleString()}</div>
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

              <div className="flex flex-col items-center gap-1">
                <span
                  className={`min-w-[120px] text-sm font-bold px-3 py-2 rounded-lg text-center ${
                    isFulfilled
                      ? "bg-green-500 text-white"
                      : "bg-gray-200 text-gray-700"
                  }`}
                >
                  {isFulfilled ? fulfilledLabel : "未提供"}
                </span>
                {isFulfilled && order.fulfilledAt && (
                  <span className="text-xs text-gray-500">{formatFulfilledAt(order.fulfilledAt)}</span>
                )}
              </div>
            </motion.div>
          );
        })}
      </div>
      </div>

      <AnimatePresence>
        {selectedOrder && (
          <OrderDetailModal order={selectedOrder} onClose={() => setSelectedOrder(null)} />
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
    </div>
  );
}
