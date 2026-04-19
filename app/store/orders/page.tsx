"use client";

import { useState, useRef, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Download, Loader2 } from "lucide-react";
import { useOrders, type OrderChannel } from "@/hooks/use-orders";
import { useStoreContext } from "@/lib/store-context";
import { useAuth } from "@/lib/auth-context";
import { useOrderMutations } from "@/hooks/use-order-mutations";
import { DatePickerPopup } from "@/components/store/date-picker-popup";
import { OrderDetailModal } from "@/components/store/order-detail-modal";
import { WholeCakeDetailModal } from "@/components/store/whole-cake-detail-modal";
import { supabase } from "@/lib/supabase";
import type { FulfillmentStatus, Order } from "@/lib/types";

const daysOfWeek = ["日", "月", "火", "水", "木", "金", "土"];

const channelTabs: { label: string; value: "" | OrderChannel }[] = [
  { label: "すべて", value: "" },
  { label: "テイクアウト", value: "takeout" },
  { label: "EC", value: "ec" },
];

type FulfillmentFilter = "" | FulfillmentStatus;
const fulfillmentOptions: { label: string; value: FulfillmentFilter }[] = [
  { label: "すべて", value: "" },
  { label: "準備中", value: "pending" },
  { label: "準備完了", value: "fulfilled" },
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

interface OrderItemOption {
  order_item_id: string;
  option_group_name_snapshot: string;
  option_item_name_snapshot: string;
  price_delta: number;
  quantity: number | null;
}

async function fetchOrderItemOptions(orderIds: string[]): Promise<Map<string, OrderItemOption[]>> {
  if (orderIds.length === 0) return new Map();
  const { data } = await supabase
    .from("order_items")
    .select(`
      id, order_id,
      order_item_options ( order_item_id, option_group_name_snapshot, option_item_name_snapshot, price_delta, quantity )
    `)
    .in("order_id", orderIds);

  const map = new Map<string, OrderItemOption[]>();
  for (const row of data ?? []) {
    const opts: OrderItemOption[] = (row.order_item_options ?? []).map((o: any) => ({
      order_item_id: o.order_item_id,
      option_group_name_snapshot: o.option_group_name_snapshot,
      option_item_name_snapshot: o.option_item_name_snapshot,
      price_delta: o.price_delta,
      quantity: o.quantity ?? null,
    }));
    if (opts.length > 0) {
      const existing = map.get(row.order_id) ?? [];
      map.set(row.order_id, [...existing, ...opts]);
    }
  }
  return map;
}

function buildCSV(orders: Order[], optionsMap: Map<string, OrderItemOption[]>): string {
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
    "デコレーション",
    "備考",
  ];
  const rows = orders.map((o) => {
    const isEc = o.orderType === "ec";
    const itemsStr = o.items.map((i) => `${i.name}x${i.quantity}`).join(" / ");
    const qtySum = o.items.reduce((s, i) => s + i.quantity, 0);
    const opts = optionsMap.get(o.id) ?? [];
    const decorations = opts
      .filter((op) => op.option_group_name_snapshot !== "サイズ" && op.option_group_name_snapshot !== "メッセージ" && op.option_group_name_snapshot !== "アレルギー" && op.option_group_name_snapshot !== "ろうそく")
      .map((op) => `${op.option_group_name_snapshot}:${op.option_item_name_snapshot}`)
      .join(" / ");
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
      decorations,
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

function printOrdersPDF(
  orders: Order[],
  optionsMap: Map<string, OrderItemOption[]>,
  title: string,
) {
  const rows = orders.map((o) => {
    const isEc = o.orderType === "ec";
    const itemsStr = o.items.map((i) => `${i.name} ×${i.quantity}`).join("<br>");
    const opts = optionsMap.get(o.id) ?? [];
    const decorations = opts
      .filter((op) => !["サイズ","メッセージ","アレルギー","ろうそく"].includes(op.option_group_name_snapshot))
      .map((op) => `${op.option_group_name_snapshot}:${op.option_item_name_snapshot}`)
      .join("<br>");
    const fulfilled = o.fulfillmentStatus === "fulfilled" ? (isEc ? "出荷済" : "受渡済") : "未提供";
    return `
      <tr>
        <td>${o.orderNo || o.id.slice(0, 8)}</td>
        <td>${o.customerName || o.lineName || "-"}</td>
        <td>${isEc ? "EC" : "テイクアウト"}</td>
        <td>${o.pickupDate || "-"} ${o.pickupTime ? o.pickupTime.slice(0,5) : ""}</td>
        <td>${itemsStr}</td>
        <td class="num">¥${o.totalAmount.toLocaleString()}</td>
        <td>${o.paymentStatus}</td>
        <td>${fulfilled}</td>
        <td>${decorations || "-"}</td>
        <td>${o.notes || "-"}</td>
      </tr>`;
  }).join("");

  const html = `<!DOCTYPE html>
<html lang="ja">
<head>
<meta charset="utf-8">
<title>${title}</title>
<style>
  body { font-family: "Hiragino Kaku Gothic Pro", "Meiryo", sans-serif; font-size: 10px; margin: 12mm; color: #111; }
  h2 { font-size: 13px; margin: 0 0 8px; }
  p.meta { font-size: 9px; color: #555; margin: 0 0 10px; }
  table { width: 100%; border-collapse: collapse; }
  th { background: #fffde7; text-align: left; padding: 5px 6px; border: 1px solid #ccc; white-space: nowrap; }
  td { padding: 5px 6px; border: 1px solid #ddd; vertical-align: top; }
  tr:nth-child(even) td { background: #fafafa; }
  .num { text-align: right; }
  @media print { @page { margin: 10mm; size: A4 landscape; } }
</style>
</head>
<body>
<h2>${title}</h2>
<p class="meta">出力日時: ${new Date().toLocaleString("ja-JP")} / 件数: ${orders.length}件</p>
<table>
<thead>
<tr>
  <th>注文番号</th><th>顧客名</th><th>区分</th><th>受取日時</th>
  <th>商品</th><th class="num">合計</th><th>支払</th><th>提供状況</th>
  <th>デコレーション</th><th>備考</th>
</tr>
</thead>
<tbody>${rows}</tbody>
</table>
<script>window.onload=()=>{window.print();}<\/script>
</body>
</html>`;

  const w = window.open("", "_blank");
  if (!w) { alert("ポップアップがブロックされています。許可してください。"); return; }
  w.document.write(html);
  w.document.close();
}

type ConfirmAction = {
  orderId: string;
  toFulfilled: boolean;
  isEc: boolean;
};

export default function StoreOrdersPage() {
  const { storeId, storeName } = useStoreContext();
  const { user } = useAuth();
  const [tab, setTab] = useState<"manage" | "history">("manage");

  // ── 当日管理タブ state ──
  const [manageChannel, setManageChannel] = useState<"" | OrderChannel>("");
  const [manageFulfillment, setManageFulfillment] = useState<FulfillmentFilter>("");
  const [selectedDate, setSelectedDate] = useState(new Date());
  const [showDatePicker, setShowDatePicker] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [confirmLoading, setConfirmLoading] = useState(false);
  const dateRef = useRef<HTMLDivElement>(null);

  const { orders: rawManageOrders, loading: manageLoading, refetch: refetchManage } = useOrders({
    storeId,
    channel: manageChannel || undefined,
    fulfillmentStatus: manageFulfillment || undefined,
    from: toISODate(selectedDate),
  });

  const manageOrders = (() => {
    const now = new Date();
    const nowMs = now.getTime();
    const getPickupMs = (o: Order): number => {
      if (!o.pickupDate) return Infinity;
      const [h, m] = (o.pickupTime || "00:00").split(":").map(Number);
      const d = new Date(o.pickupDate);
      d.setHours(h || 0, m || 0, 0, 0);
      return d.getTime();
    };
    return rawManageOrders
      .filter((o) => !(o.orderType === "ec" && o.fulfillmentStatus === "fulfilled"))
      .sort((a, b) => {
        const ta = getPickupMs(a);
        const tb = getPickupMs(b);
        const aFuture = ta >= nowMs;
        const bFuture = tb >= nowMs;
        if (aFuture && !bFuture) return -1;
        if (!aFuture && bFuture) return 1;
        if (aFuture && bFuture) return ta - tb;
        return tb - ta;
      });
  })();

  // ── 注文履歴タブ state ──
  const today = new Date();
  const defaultFrom = new Date(today);
  defaultFrom.setMonth(today.getMonth() - 1);

  const [historyChannel, setHistoryChannel] = useState<"" | OrderChannel>("");
  const [historyFulfillment, setHistoryFulfillment] = useState<FulfillmentFilter>("");
  const [fromDate, setFromDate] = useState<Date>(defaultFrom);
  const [toDate, setToDate] = useState<Date>(today);
  const [showFromPicker, setShowFromPicker] = useState(false);
  const [showToPicker, setShowToPicker] = useState(false);
  const [selectedOrder, setSelectedOrder] = useState<Order | null>(null);
  const [wholeCakeDetailOrder, setWholeCakeDetailOrder] = useState<Order | null>(null);
  const [csvExporting, setCsvExporting] = useState(false);
  const fromRef = useRef<HTMLDivElement>(null);
  const toRef = useRef<HTMLDivElement>(null);

  const { orders: historyOrders, loading: historyLoading } = useOrders({
    storeId,
    from: toISODate(fromDate),
    to: toISODate(toDate, true),
    channel: historyChannel || undefined,
    fulfillmentStatus: historyFulfillment || undefined,
  });

  const { updateFulfillmentStatus } = useOrderMutations();

  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (dateRef.current && !dateRef.current.contains(e.target as Node)) {
        setShowDatePicker(false);
      }
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

  const handleConfirm = async () => {
    if (!confirmAction || confirmLoading) return;
    setConfirmLoading(true);
    try {
      await updateFulfillmentStatus(
        confirmAction.orderId,
        confirmAction.toFulfilled,
        user?.id ?? null,
      );
      await refetchManage();
    } finally {
      setConfirmAction(null);
      setConfirmLoading(false);
    }
  };

  const handleExportCSV = async () => {
    if (historyOrders.length === 0) {
      alert("エクスポートする注文がありません");
      return;
    }
    setCsvExporting(true);
    try {
      const orderIds = historyOrders.map((o) => o.id);
      const optionsMap = await fetchOrderItemOptions(orderIds);
      const slug = (storeName || "store").replace(/\s+/g, "_");
      const filename = `orders_${slug}_${yyyymmdd(fromDate)}_${yyyymmdd(toDate)}.csv`;
      downloadCSV(filename, buildCSV(historyOrders, optionsMap));
    } finally {
      setCsvExporting(false);
    }
  };

  const [manageCsvExporting, setManageCsvExporting] = useState(false);
  const handleManageExportCSV = async () => {
    if (manageOrders.length === 0) {
      alert("エクスポートする注文がありません");
      return;
    }
    setManageCsvExporting(true);
    try {
      const orderIds = manageOrders.map((o) => o.id);
      const optionsMap = await fetchOrderItemOptions(orderIds);
      const slug = (storeName || "store").replace(/\s+/g, "_");
      const filename = `orders_${slug}_${yyyymmdd(selectedDate)}_以降.csv`;
      downloadCSV(filename, buildCSV(manageOrders, optionsMap));
    } finally {
      setManageCsvExporting(false);
    }
  };

  const [managePdfExporting, setManagePdfExporting] = useState(false);
  const handleManageExportPDF = async () => {
    if (manageOrders.length === 0) {
      alert("エクスポートする注文がありません");
      return;
    }
    setManagePdfExporting(true);
    try {
      const orderIds = manageOrders.map((o) => o.id);
      const optionsMap = await fetchOrderItemOptions(orderIds);
      const slug = (storeName || "store").replace(/\s+/g, "_");
      printOrdersPDF(manageOrders, optionsMap, `予約管理 ${slug} ${yyyymmdd(selectedDate)}〜`);
    } finally {
      setManagePdfExporting(false);
    }
  };

  const [pdfExporting, setPdfExporting] = useState(false);
  const handleExportPDF = async () => {
    if (historyOrders.length === 0) {
      alert("エクスポートする注文がありません");
      return;
    }
    setPdfExporting(true);
    try {
      const orderIds = historyOrders.map((o) => o.id);
      const optionsMap = await fetchOrderItemOptions(orderIds);
      const slug = (storeName || "store").replace(/\s+/g, "_");
      printOrdersPDF(historyOrders, optionsMap, `注文履歴 ${slug} ${yyyymmdd(fromDate)}〜${yyyymmdd(toDate)}`);
    } finally {
      setPdfExporting(false);
    }
  };

  return (
    <div className="p-6">
      {/* タブ切り替え */}
      <div className="flex border-b border-gray-200 mb-6">
        {([["manage", "予約管理"], ["history", "注文履歴"]] as const).map(([value, label]) => (
          <button
            key={value}
            onClick={() => setTab(value)}
            className={`px-6 py-3 text-sm font-bold border-b-2 transition-colors ${
              tab === value
                ? "border-amber-400 text-amber-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      {/* ── 当日管理タブ ── */}
      {tab === "manage" && (
        <>
          <div className="flex items-center justify-between gap-4 mb-6 flex-wrap">
            <div className="flex items-center gap-3 flex-wrap">
              <div className="flex gap-2">
                {channelTabs.map((t) => (
                  <button
                    key={t.label}
                    onClick={() => setManageChannel(t.value)}
                    className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
                      manageChannel === t.value
                        ? "bg-amber-400 text-white border-amber-400"
                        : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                    }`}
                  >
                    {t.label}
                  </button>
                ))}
              </div>
              <select
                value={manageFulfillment}
                onChange={(e) => setManageFulfillment(e.target.value as FulfillmentFilter)}
                className="border border-gray-300 rounded-lg px-3 py-2 text-sm text-gray-700 bg-white focus:outline-none focus:ring-2 focus:ring-amber-300"
              >
                {fulfillmentOptions.map((o) => (
                  <option key={o.value} value={o.value}>{o.label}</option>
                ))}
              </select>
            </div>
            <div className="flex items-center gap-2">
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
                      onSelect={(date) => { setSelectedDate(date); setShowDatePicker(false); }}
                      onClear={() => { setSelectedDate(new Date()); setShowDatePicker(false); }}
                      onClose={() => setShowDatePicker(false)}
                    />
                  )}
                </AnimatePresence>
              </div>
              <div className="flex gap-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => void handleManageExportCSV()}
                  disabled={manageCsvExporting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {manageCsvExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  CSV
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => void handleManageExportPDF()}
                  disabled={managePdfExporting}
                  className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
                >
                  {managePdfExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                  PDF
                </motion.button>
              </div>
            </div>
          </div>

          <div className="overflow-x-auto">
          <div className="min-w-[640px] border border-gray-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[160px_150px_minmax(0,1fr)_130px_80px] bg-[#FFF176] pl-1 pr-4 py-3 text-xs font-bold text-gray-700 items-center">
              <span className="pl-3">顧客名</span>
              <span>来店/発送</span>
              <span>注文内容</span>
              <span>合計金額</span>
              <span className="text-center">提供状況</span>
            </div>

            {manageLoading && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">読み込み中...</div>
            )}
            {!manageLoading && manageOrders.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400 bg-white">
                該当する注文はありません
              </div>
            )}

            {manageOrders.map((order, i) => {
              const isEc = order.orderType === "ec";
              const isFulfilled = order.fulfillmentStatus === "fulfilled";
              const fulfilledLabel = isEc ? "出荷済" : "受渡済";

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.03 }}
                  className={`grid grid-cols-[160px_150px_minmax(0,1fr)_130px_80px] pr-4 py-4 items-center border-t border-gray-100 border-l-4 ${
                    isFulfilled
                      ? "bg-gray-50 border-l-gray-300"
                      : isEc
                      ? "bg-amber-50 border-l-amber-400"
                      : "bg-white border-l-gray-200"
                  }`}
                >
                  <div className="pl-3">
                    <span className="text-xs">{order.customerName || "-"}</span>
                  </div>
                  <div className="text-sm text-gray-700">
                    {isEc ? (
                      <div className="text-xs text-gray-500 leading-tight line-clamp-2">
                        {order.notes?.split("　配送時間")[0] || "-"}
                      </div>
                    ) : (
                      <>
                        {order.pickupTime && <div className="font-medium">{order.pickupTime.slice(0, 5)}</div>}
                        {order.pickupDate && <div className="text-xs text-gray-500">{order.pickupDate}</div>}
                      </>
                    )}
                  </div>
                  <div className="text-sm leading-relaxed">
                    {order.items.map((item, j) => (
                      <div key={j} className="flex items-center gap-1.5">
                        <span>{item.name}</span>
                        {item.variantName ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setWholeCakeDetailOrder(order); }}
                            className="shrink-0 bg-amber-400 hover:bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors"
                          >
                            詳細
                          </button>
                        ) : (
                          <span className="text-gray-400 text-xs shrink-0">×{item.quantity}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-sm font-bold">&yen;{order.totalAmount.toLocaleString()}</div>
                    <div className={`text-xs ${order.paymentStatus === "決済済み" ? "text-green-600" : order.paymentStatus === "店頭支払い" || order.paymentStatus === "銀行振込" ? "text-blue-600" : "text-gray-500"}`}>
                      {order.paymentStatus}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <motion.button
                      whileHover={{ scale: 1.08 }}
                      whileTap={{ scale: 0.92 }}
                      onClick={() => setConfirmAction({ orderId: order.id, toFulfilled: !isFulfilled, isEc })}
                      className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold transition-colors ${isFulfilled ? "bg-amber-400 hover:bg-amber-500 text-white" : "bg-gray-200 hover:bg-gray-300 text-gray-700"}`}
                    >
                      {isFulfilled ? "済" : "未"}
                    </motion.button>
                    {order.fulfilledAt && (
                      <div className="flex flex-col items-center">
                        <span className="text-[10px] text-gray-400 leading-none">更新</span>
                        <span className="text-xs text-gray-700 font-medium tabular-nums">{formatFulfilledAt(order.fulfilledAt)}</span>
                      </div>
                    )}
                  </div>
                </motion.div>
              );
            })}
          </div>
          </div>
        </>
      )}

      {/* ── 注文履歴タブ ── */}
      {tab === "history" && (
        <>
          <div className="flex flex-wrap items-center justify-between gap-4 mb-4">
            <div className="flex gap-2">
              {channelTabs.map((t) => (
                <button
                  key={t.label}
                  onClick={() => setHistoryChannel(t.value)}
                  className={`px-4 py-2 rounded-lg text-sm font-bold border transition-colors ${
                    historyChannel === t.value
                      ? "bg-amber-400 text-white border-amber-400"
                      : "bg-white text-gray-600 border-gray-300 hover:bg-gray-50"
                  }`}
                >
                  {t.label}
                </button>
              ))}
            </div>
            <div className="flex gap-2">
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => void handleExportCSV()}
                disabled={csvExporting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-green-600 hover:bg-green-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {csvExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                CSV
              </motion.button>
              <motion.button
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
                onClick={() => void handleExportPDF()}
                disabled={pdfExporting}
                className="inline-flex items-center gap-2 px-4 py-2 rounded-lg bg-red-600 hover:bg-red-700 text-white text-sm font-bold transition-colors disabled:opacity-50"
              >
                {pdfExporting ? <Loader2 className="w-4 h-4 animate-spin" /> : <Download className="w-4 h-4" />}
                PDF
              </motion.button>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3 mb-6">
            <div className="flex gap-1">
              {fulfillmentOptions.map((t) => (
                <button
                  key={t.value}
                  onClick={() => setHistoryFulfillment(t.value)}
                  className={`px-3 py-1.5 rounded-lg text-xs font-bold border transition-colors ${
                    historyFulfillment === t.value
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
          <div className="min-w-[640px] border border-gray-200 rounded-lg overflow-hidden">
            <div className="grid grid-cols-[160px_150px_minmax(0,1fr)_130px_80px] bg-[#FFF176] pl-1 pr-4 py-3 text-xs font-bold text-gray-700 items-center">
              <span className="pl-3">顧客名</span>
              <span>受取/発送</span>
              <span>注文内容</span>
              <span>合計金額</span>
              <span className="text-center">提供状況</span>
            </div>

            {historyLoading && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">読み込み中...</div>
            )}
            {!historyLoading && historyOrders.length === 0 && (
              <div className="px-4 py-8 text-center text-sm text-gray-400">注文履歴はありません</div>
            )}

            {historyOrders.map((order, i) => {
              const isEc = order.orderType === "ec";
              const isFulfilled = order.fulfillmentStatus === "fulfilled";
              const fulfilledLabel = isEc ? "出荷済" : "受渡済";

              return (
                <motion.div
                  key={order.id}
                  initial={{ opacity: 0 }}
                  animate={{ opacity: 1 }}
                  transition={{ delay: i * 0.02 }}
                  className={`grid grid-cols-[160px_150px_minmax(0,1fr)_130px_80px] pr-4 py-4 items-center border-t border-gray-100 border-l-4 cursor-pointer transition-colors ${
                    isFulfilled
                      ? "bg-gray-50 border-l-gray-300 hover:bg-gray-100"
                      : isEc
                      ? "bg-sky-50 border-l-sky-400 hover:bg-sky-100"
                      : "bg-amber-50 border-l-amber-400 hover:bg-amber-100"
                  }`}
                  onClick={() => setSelectedOrder(order)}
                >
                  <div className="pl-3">
                    <span className="text-xs">{order.customerName || order.lineName || "-"}</span>
                  </div>
                  <div className="text-sm text-gray-700">
                    {order.pickupDate && <div className="font-medium">{order.pickupDate}</div>}
                    {order.pickupTime && <div className="text-xs text-gray-500">{order.pickupTime.slice(0, 5)}</div>}
                  </div>
                  <div className="text-sm leading-relaxed">
                    {order.items.map((item, j) => (
                      <div key={j} className="flex items-center gap-1.5">
                        <span>{item.name}</span>
                        {item.variantName ? (
                          <button
                            onClick={(e) => { e.stopPropagation(); setWholeCakeDetailOrder(order); }}
                            className="shrink-0 bg-amber-400 hover:bg-amber-500 text-white text-[10px] font-bold px-1.5 py-0.5 rounded transition-colors"
                          >
                            詳細
                          </button>
                        ) : (
                          <span className="text-gray-500 text-xs shrink-0">×{item.quantity}</span>
                        )}
                      </div>
                    ))}
                  </div>
                  <div>
                    <div className="text-sm font-bold">¥{order.totalAmount.toLocaleString()}</div>
                    <div className={`text-xs ${order.paymentStatus === "決済済み" ? "text-green-600" : order.paymentStatus === "店頭支払い" || order.paymentStatus === "銀行振込" ? "text-blue-600" : "text-gray-500"}`}>
                      {order.paymentStatus}
                    </div>
                  </div>
                  <div className="flex flex-col items-center gap-1">
                    <span className={`w-10 h-10 rounded-full flex items-center justify-center text-xs font-bold ${isFulfilled ? "bg-amber-400 text-white" : "bg-gray-200 text-gray-700"}`}>
                      {isFulfilled ? "済" : "未"}
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
        </>
      )}

      {/* 提供状況変更確認モーダル */}
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
                  ? confirmAction.isEc ? "出荷済にします" : "受渡済にします"
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
                  className={`flex-1 font-bold py-2.5 rounded-full text-sm flex items-center justify-center gap-1 disabled:opacity-60 text-white ${confirmAction.toFulfilled ? "bg-green-500 hover:bg-green-600" : "bg-gray-500 hover:bg-gray-600"}`}
                >
                  {confirmLoading && <Loader2 className="w-4 h-4 animate-spin" />}
                  はい
                </button>
              </div>
            </motion.div>
          </>
        )}
      </AnimatePresence>

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
