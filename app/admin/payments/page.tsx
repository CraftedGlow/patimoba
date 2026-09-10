"use client";

import { useEffect, useState, useCallback, useMemo } from "react";
import { motion } from "framer-motion";
import { Wallet, CreditCard, Undo2 } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import { fetchStores, fetchOrders, type Store, type Order } from "@/lib/admin-api";

// JST = UTC+9。日本固定アプリなので JST で月の境界を計算する
function jstMonthBoundaries(year: number, month: number) {
  const JST_OFFSET_MS = 9 * 60 * 60 * 1000;
  const start = new Date(Date.UTC(year, month, 1) - JST_OFFSET_MS).toISOString();
  const end = new Date(Date.UTC(year, month + 1, 1) - JST_OFFSET_MS).toISOString();
  return { start, end };
}

interface StoreBreakdown {
  storeId: string;
  storeName: string;
  unpaidCount: number;
  unpaidAmount: number;
  paidCount: number;
  paidAmount: number;
  refundedCount: number;
  refundedAmount: number;
}

export default function AdminPaymentsPage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const [selYear, selMonth] = selectedMonth.split("-").map(Number);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const { start, end } = jstMonthBoundaries(selYear, selMonth - 1);
      const [s, o] = await Promise.all([fetchStores(), fetchOrders(start, end)]);
      setStores(s);
      setOrders(o);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selYear, selMonth]);

  useEffect(() => {
    load();
  }, [load]);

  const breakdown = useMemo<StoreBreakdown[]>(() => {
    const storeNameById = new Map(stores.map((s) => [s.id, s.name]));
    const byStore = new Map<string, StoreBreakdown>();

    for (const o of orders) {
      if (o.order_status === "cancelled") continue;
      const storeId = o.store_id;
      if (!storeId) continue;

      let row = byStore.get(storeId);
      if (!row) {
        row = {
          storeId,
          storeName: storeNameById.get(storeId) ?? "不明な店舗",
          unpaidCount: 0,
          unpaidAmount: 0,
          paidCount: 0,
          paidAmount: 0,
          refundedCount: 0,
          refundedAmount: 0,
        };
        byStore.set(storeId, row);
      }

      const amount = Number(o.total_amount) || 0;
      if (o.payment_status === "paid") {
        row.paidCount++;
        row.paidAmount += amount;
      } else if (o.payment_status === "refunded") {
        row.refundedCount++;
        row.refundedAmount += amount;
      } else {
        row.unpaidCount++;
        row.unpaidAmount += amount;
      }
    }

    return Array.from(byStore.values()).sort(
      (a, b) => b.paidAmount + b.unpaidAmount - (a.paidAmount + a.unpaidAmount)
    );
  }, [orders, stores]);

  const totals = useMemo(() => {
    return breakdown.reduce(
      (acc, r) => {
        acc.unpaidAmount += r.unpaidAmount;
        acc.paidAmount += r.paidAmount;
        acc.refundedAmount += r.refundedAmount;
        return acc;
      },
      { unpaidAmount: 0, paidAmount: 0, refundedAmount: 0 }
    );
  }, [breakdown]);

  const grandTotal = totals.unpaidAmount + totals.paidAmount;
  const dateLabel = `${selYear}年${selMonth}月`;

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <LineSpinner size={30} />
      </div>
    );
  }

  return (
    <>
      <header className="bg-[#FFF9C4] px-4 sm:px-6 py-4 border-b border-yellow-200 flex items-center justify-between">
        <div>
          <h1 className="text-base sm:text-lg font-bold text-gray-900">支払い方法別集計</h1>
          <p className="text-xs text-gray-600">{dateLabel}・店舗ごとの店頭支払い/カード決済内訳</p>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </header>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
              <Wallet className="w-3.5 h-3.5" />
              店頭支払い合計
            </div>
            <p className="text-2xl font-bold">&yen;{totals.unpaidAmount.toLocaleString()}</p>
            <p className="text-xs mt-1 text-gray-500">
              {grandTotal > 0 ? Math.round((totals.unpaidAmount / grandTotal) * 100) : 0}%
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.05 }}
            className="bg-white rounded-xl border border-gray-200 p-5"
          >
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
              <CreditCard className="w-3.5 h-3.5" />
              カード決済合計
            </div>
            <p className="text-2xl font-bold">&yen;{totals.paidAmount.toLocaleString()}</p>
            <p className="text-xs mt-1 text-gray-500">
              {grandTotal > 0 ? Math.round((totals.paidAmount / grandTotal) * 100) : 0}%
            </p>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
            className="bg-white rounded-xl border border-gray-200 p-5 col-span-2 sm:col-span-1"
          >
            <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
              <Undo2 className="w-3.5 h-3.5" />
              返金合計
            </div>
            <p className="text-2xl font-bold text-gray-400">&yen;{totals.refundedAmount.toLocaleString()}</p>
            <p className="text-xs mt-1 text-gray-500">集計対象外</p>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.15 }}
          className="bg-white rounded-xl border border-gray-200 overflow-hidden"
        >
          <div className="px-6 py-4 border-b border-gray-100">
            <h2 className="font-bold text-sm">店舗別内訳</h2>
          </div>

          {breakdown.length === 0 ? (
            <p className="text-sm text-gray-400 text-center py-12">この期間の注文はありません</p>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-sm">
                <thead>
                  <tr className="text-left text-xs text-gray-500 border-b border-gray-100">
                    <th className="px-6 py-3 font-medium">店舗名</th>
                    <th className="px-4 py-3 font-medium text-right">店頭支払い</th>
                    <th className="px-4 py-3 font-medium text-right">カード決済</th>
                    <th className="px-4 py-3 font-medium text-right">返金</th>
                    <th className="px-6 py-3 font-medium text-right">合計</th>
                  </tr>
                </thead>
                <tbody>
                  {breakdown.map((row) => (
                    <tr key={row.storeId} className="border-b border-gray-50 last:border-0">
                      <td className="px-6 py-3 font-medium">{row.storeName}</td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium">&yen;{row.unpaidAmount.toLocaleString()}</span>
                        <span className="text-xs text-gray-400 ml-1">({row.unpaidCount}件)</span>
                      </td>
                      <td className="px-4 py-3 text-right">
                        <span className="font-medium">&yen;{row.paidAmount.toLocaleString()}</span>
                        <span className="text-xs text-gray-400 ml-1">({row.paidCount}件)</span>
                      </td>
                      <td className="px-4 py-3 text-right text-gray-400">
                        &yen;{row.refundedAmount.toLocaleString()}
                        <span className="text-xs ml-1">({row.refundedCount}件)</span>
                      </td>
                      <td className="px-6 py-3 text-right font-bold">
                        &yen;{(row.unpaidAmount + row.paidAmount).toLocaleString()}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </motion.div>
      </div>
    </>
  );
}
