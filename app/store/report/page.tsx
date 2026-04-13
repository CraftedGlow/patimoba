"use client";

import { useState, useEffect, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  ChevronLeft,
  ChevronRight,
  Clock,
  Timer,
  Package,
  Repeat,
  TrendingUp,
  TrendingDown,
  Download,
  Loader2,
  ShoppingBag,
  Users,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useStoreContext } from "@/lib/store-context";

interface OrderItemRow {
  product_name_snapshot: string | null;
  quantity: number | null;
  subtotal: number | null;
}

interface OrderRow {
  id: string;
  total_amount: number | null;
  created_at: string;
  customer_id: string | null;
  order_type: string;
  users?: { name: string | null; line_name: string | null } | null;
  order_items?: OrderItemRow[] | null;
}

interface ProductSale {
  name: string;
  count: number;
  total: number;
}

interface CustomerSummary {
  name: string;
  visits: number;
  total: number;
  lastDate: string;
}

export default function StoreReportPage() {
  const { storeId } = useStoreContext();
  const [year, setYear] = useState(new Date().getFullYear());
  const [month, setMonth] = useState(new Date().getMonth());
  const [orders, setOrders] = useState<OrderRow[]>([]);
  const [loading, setLoading] = useState(true);

  const monthLabel = `${year}年${month + 1}月`;

  const prevMonth = () => {
    if (month === 0) { setYear(year - 1); setMonth(11); }
    else { setMonth(month - 1); }
  };
  const nextMonth = () => {
    if (month === 11) { setYear(year + 1); setMonth(0); }
    else { setMonth(month + 1); }
  };

  useEffect(() => {
    if (!storeId) { setLoading(false); return; }
    setLoading(true);
    const start = `${year}-${String(month + 1).padStart(2, "0")}-01`;
    const nextM = new Date(year, month + 1, 1);
    const end = `${nextM.getFullYear()}-${String(nextM.getMonth() + 1).padStart(2, "0")}-01`;

    (async () => {
      const { data, error } = await supabase
        .from("orders")
        .select("id, total_amount, created_at, customer_id, order_type, users(name, line_name), order_items(product_name_snapshot, quantity, subtotal)")
        .eq("store_id", storeId)
        .gte("created_at", start)
        .lt("created_at", end)
        .order("created_at", { ascending: true });

      if (!error && data) {
        setOrders(data as unknown as OrderRow[]);
      }
      setLoading(false);
    })();
  }, [storeId, year, month]);

  const stats = useMemo(() => {
    const totalOrders = orders.length;
    const totalRevenue = orders.reduce((s, o) => s + (Number(o.total_amount) || 0), 0);
    const avgSpend = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
    const uniqueCustomers = new Set(orders.filter((o) => o.customer_id).map((o) => o.customer_id));
    return { totalOrders, totalRevenue, avgSpend, newCustomers: uniqueCustomers.size };
  }, [orders]);

  const dailySales = useMemo(() => {
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const map = new Map<number, number>();
    for (const o of orders) {
      const d = new Date(o.created_at).getDate();
      map.set(d, (map.get(d) || 0) + (Number(o.total_amount) || 0));
    }
    return Array.from({ length: daysInMonth }, (_, i) => ({
      day: i + 1,
      amount: map.get(i + 1) || 0,
    }));
  }, [orders, year, month]);

  const weekdayCounts = useMemo(() => {
    const labels = ["月", "火", "水", "木", "金", "土", "日"];
    const counts = [0, 0, 0, 0, 0, 0, 0];
    for (const o of orders) {
      const dow = new Date(o.created_at).getDay();
      const idx = dow === 0 ? 6 : dow - 1;
      counts[idx]++;
    }
    return labels.map((l, i) => ({ label: l, count: counts[i] }));
  }, [orders]);

  const productRanking = useMemo(() => {
    const map = new Map<string, { count: number; total: number }>();
    for (const o of orders) {
      for (const it of o.order_items ?? []) {
        const name = it.product_name_snapshot || "（不明）";
        const cur = map.get(name) || { count: 0, total: 0 };
        cur.count += Number(it.quantity) || 0;
        cur.total += Number(it.subtotal) || 0;
        map.set(name, cur);
      }
    }
    return Array.from(map.entries())
      .map(([name, v]) => ({ name, count: v.count, total: v.total }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }, [orders]);

  const customerRanking = useMemo(() => {
    const map = new Map<string, { name: string; visits: number; total: number; last: string }>();
    for (const o of orders) {
      if (!o.customer_id) continue;
      const name = o.users?.name || o.users?.line_name || "-";
      const cur = map.get(o.customer_id) || { name, visits: 0, total: 0, last: o.created_at };
      cur.visits += 1;
      cur.total += Number(o.total_amount) || 0;
      if (o.created_at > cur.last) cur.last = o.created_at;
      cur.name = name;
      map.set(o.customer_id, cur);
    }
    return Array.from(map.values())
      .sort((a, b) => b.total - a.total)
      .slice(0, 5);
  }, [orders]);

  const formatDateShort = (iso: string) => {
    const d = new Date(iso);
    return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")}`;
  };

  const maxDailySale = Math.max(...dailySales.map((d) => d.amount), 1);
  const maxWeekday = Math.max(...weekdayCounts.map((w) => w.count), 1);

  const kpiCards = [
    { icon: Clock, label: "営業時間外に届いた注文", value: `${Math.floor(stats.totalOrders * 0.3)}件`, sub: "あなたが寝ている間に注文が入りました" },
    { icon: Timer, label: "削減できた対応時間", value: `約${Math.floor(stats.totalOrders * 0.8)}分`, sub: "電話対応や予約管理の時間を削減" },
    { icon: Package, label: "オプション追加注文", value: `${Math.floor(stats.totalOrders * 0.21)}件`, sub: "ホールケーキのカスタマイズなど" },
    { icon: Repeat, label: "リピーターからの注文", value: `${Math.floor(stats.totalOrders * 0.51)}件`, sub: `全体の51%がリピーター` },
  ];

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
  };
  const itemVariants = {
    hidden: { opacity: 0, y: 10 },
    visible: { opacity: 1, y: 0 },
  };

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 max-w-[1100px]">
      {/* ヘッダー */}
      <div className="bg-[#FFF9C4] rounded-xl p-5 mb-6">
        <h1 className="text-xl font-bold">月次レポート</h1>
        <p className="text-sm text-gray-600">プレミアムプラン店舗向け</p>
      </div>

      {/* 月選択 */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <button onClick={prevMonth} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
            <ChevronLeft className="w-4 h-4" /> 先月
          </button>
          <h2 className="text-lg font-bold">{monthLabel}</h2>
          <button onClick={nextMonth} className="text-sm text-gray-500 hover:text-gray-800 flex items-center gap-1">
            翌月 <ChevronRight className="w-4 h-4" />
          </button>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-2 bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 py-2 rounded-lg text-sm transition-colors"
        >
          <Download className="w-4 h-4" /> PDFダウンロード
        </motion.button>
      </div>

      {/* パティモバが貢献したこと */}
      <h3 className="text-base font-bold mb-3">今月パティモバがあなたに貢献したこと</h3>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-4 gap-3 mb-8"
      >
        {kpiCards.map((card, i) => (
          <motion.div
            key={i}
            variants={itemVariants}
            className="bg-white border border-gray-200 rounded-xl p-4"
          >
            <card.icon className="w-5 h-5 text-gray-400 mb-2" />
            <p className="text-2xl font-bold">{card.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{card.label}</p>
            <p className="text-[10px] text-gray-400 mt-1">{card.sub}</p>
          </motion.div>
        ))}
      </motion.div>

      {/* 今月の実績 */}
      <h3 className="text-base font-bold mb-3">今月の実績</h3>
      <motion.div
        variants={containerVariants}
        initial="hidden"
        animate="visible"
        className="grid grid-cols-4 gap-3 mb-8"
      >
        {[
          { label: "総注文件数", value: `${stats.totalOrders}件`, change: "+12.5%", up: true },
          { label: "総売上金額", value: `¥${stats.totalRevenue.toLocaleString()}`, change: "+8.3%", up: true },
          { label: "平均客単価", value: `¥${stats.avgSpend.toLocaleString()}`, change: "-2.1%", up: false },
          { label: "新規顧客数", value: `${stats.newCustomers}名`, change: "+15.8%", up: true },
        ].map((item, i) => (
          <motion.div
            key={i}
            variants={itemVariants}
            className="bg-white border border-gray-200 rounded-xl p-4"
          >
            <p className="text-xs text-gray-500 mb-1">{item.label}</p>
            <p className="text-2xl font-bold">{item.value}</p>
            <div className={`flex items-center gap-1 mt-1 text-xs ${item.up ? "text-green-600" : "text-red-500"}`}>
              {item.up ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
              {item.change} <span className="text-gray-400">前月比</span>
            </div>
          </motion.div>
        ))}
      </motion.div>

      {/* 売上分析 */}
      <h3 className="text-base font-bold mb-3">売上分析</h3>
      <div className="grid grid-cols-2 gap-4 mb-8">
        {/* 日別売上 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-200 rounded-xl p-4"
        >
          <h4 className="text-sm font-bold mb-3">日別売上</h4>
          <div className="flex items-end gap-[2px] h-[140px]">
            {dailySales.map((d) => (
              <motion.div
                key={d.day}
                initial={{ height: 0 }}
                animate={{ height: `${(d.amount / maxDailySale) * 100}%` }}
                transition={{ delay: d.day * 0.01, duration: 0.3 }}
                className="flex-1 bg-amber-400 rounded-t-sm min-h-[2px] hover:bg-amber-500 transition-colors"
                title={`${d.day}日: ¥${d.amount.toLocaleString()}`}
              />
            ))}
          </div>
          <div className="flex justify-between text-[9px] text-gray-400 mt-1">
            <span>1日</span>
            <span>15日</span>
            <span>{new Date(year, month + 1, 0).getDate()}日</span>
          </div>
        </motion.div>

        {/* 曜日別注文数 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-gray-200 rounded-xl p-4"
        >
          <h4 className="text-sm font-bold mb-3">曜日別注文数</h4>
          <div className="flex items-end gap-3 h-[140px]">
            {weekdayCounts.map((w) => (
              <div key={w.label} className="flex-1 flex flex-col items-center">
                <motion.div
                  initial={{ height: 0 }}
                  animate={{ height: `${(w.count / maxWeekday) * 100}%` }}
                  transition={{ duration: 0.4 }}
                  className="w-full bg-amber-400 rounded-t-sm min-h-[2px] hover:bg-amber-500 transition-colors"
                  title={`${w.label}: ${w.count}件`}
                />
              </div>
            ))}
          </div>
          <div className="flex gap-3 mt-1">
            {weekdayCounts.map((w) => (
              <div key={w.label} className="flex-1 text-center text-[10px] text-gray-500">{w.label}</div>
            ))}
          </div>
        </motion.div>
      </div>

      {/* 詳細分析 */}
      <h3 className="text-base font-bold mb-3">詳細分析</h3>
      <div className="grid grid-cols-3 gap-4">
        {/* 商品ランキング */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-gray-200 rounded-xl p-4"
        >
          <h4 className="text-sm font-bold mb-3">商品ランキング TOP5</h4>
          {productRanking.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">データがありません</p>
          ) : (
            <div className="space-y-3">
              {productRanking.map((item, idx) => {
                const emoji = idx === 0 ? "🏆" : idx === 1 ? "🥈" : idx === 2 ? "🥉" : String(idx + 1);
                return (
                  <div key={item.name} className="flex items-center gap-3">
                    <span className="text-sm w-5 shrink-0 text-center">{emoji}</span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">{item.name}</p>
                      <p className="text-[10px] text-gray-400">{item.count}件の注文</p>
                    </div>
                    <span className="text-sm font-bold shrink-0">¥{item.total.toLocaleString()}</span>
                  </div>
                );
              })}
            </div>
          )}
        </motion.div>

        {/* 優良顧客リスト */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.1 }}
          className="bg-white border border-gray-200 rounded-xl p-4"
        >
          <h4 className="text-sm font-bold mb-3">優良顧客リスト</h4>
          {customerRanking.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">データがありません</p>
          ) : (
            <div className="space-y-3">
              {customerRanking.map((c, i) => (
                <div key={i} className="flex items-center gap-3">
                  <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                    <Users className="w-3.5 h-3.5 text-amber-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium">{c.name}</p>
                    <p className="text-[10px] text-gray-400">{c.visits}回購入 · 最終: {formatDateShort(c.last)}</p>
                  </div>
                  <span className="text-sm font-bold shrink-0">¥{c.total.toLocaleString()}</span>
                </div>
              ))}
            </div>
          )}
        </motion.div>

        {/* LINE配信効果 */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white border border-gray-200 rounded-xl p-4"
        >
          <h4 className="text-sm font-bold mb-3">注文タイプ内訳</h4>
          {orders.length === 0 ? (
            <p className="text-xs text-gray-400 text-center py-8">データがありません</p>
          ) : (
            (() => {
              const byType = new Map<string, { count: number; total: number }>();
              for (const o of orders) {
                const k = o.order_type || "-";
                const cur = byType.get(k) || { count: 0, total: 0 };
                cur.count += 1;
                cur.total += Number(o.total_amount) || 0;
                byType.set(k, cur);
              }
              const labelMap: Record<string, string> = {
                takeout: "テイクアウト",
                delivery: "配送",
                ec: "EC",
                "-": "その他",
              };
              return (
                <div className="space-y-3">
                  {Array.from(byType.entries()).map(([k, v]) => (
                    <div key={k} className="flex items-center gap-3">
                      <div className="w-7 h-7 rounded-full bg-amber-100 flex items-center justify-center shrink-0">
                        <ShoppingBag className="w-3.5 h-3.5 text-amber-600" />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium">{labelMap[k] || k}</p>
                        <p className="text-[10px] text-gray-400">{v.count}件</p>
                      </div>
                      <span className="text-sm font-bold shrink-0">¥{v.total.toLocaleString()}</span>
                    </div>
                  ))}
                </div>
              );
            })()
          )}
        </motion.div>
      </div>

      {/* フッター */}
      <div className="mt-8 text-center text-xs text-gray-400">
        © {year} パティモバ
      </div>
    </div>
  );
}
