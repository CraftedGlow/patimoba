"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { DollarSign, TrendingUp, Loader2 } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
  LineChart,
  Line,
} from "recharts";
import {
  fetchStores,
  fetchOrders,
  computeMRR,
  computePlanBreakdown,
  mrrFromPlan,
  type Store,
  type Order,
} from "@/lib/admin-api";

function groupByMonth<T extends { created_at: string | null }>(
  items: T[],
  monthsBack: number,
  ref: Date
) {
  const buckets: { month: string; count: number; year: number; m: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    buckets.push({
      month: `${d.getMonth() + 1}月`,
      count: 0,
      year: d.getFullYear(),
      m: d.getMonth(),
    });
  }
  for (const item of items) {
    if (!item.created_at) continue;
    const d = new Date(item.created_at);
    for (const b of buckets) {
      if (d.getFullYear() === b.year && d.getMonth() === b.m) {
        b.count++;
        break;
      }
    }
  }
  return buckets;
}

function groupRevenueByMonth(orders: Order[], monthsBack: number, ref: Date) {
  const buckets: { month: string; revenue: number; year: number; m: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(ref.getFullYear(), ref.getMonth() - i, 1);
    buckets.push({
      month: `${d.getMonth() + 1}月`,
      revenue: 0,
      year: d.getFullYear(),
      m: d.getMonth(),
    });
  }
  for (const o of orders) {
    if (!o.created_at) continue;
    const d = new Date(o.created_at);
    for (const b of buckets) {
      if (d.getFullYear() === b.year && d.getMonth() === b.m) {
        b.revenue += o.subtotal ?? 0;
        break;
      }
    }
  }
  return buckets;
}

export default function AdminRevenuePage() {
  const [stores, setStores] = useState<Store[]>([]);
  const [allOrders, setAllOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedMonth, setSelectedMonth] = useState(() => {
    const now = new Date();
    return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  });

  const load = useCallback(async () => {
    try {
      const [s, o] = await Promise.all([fetchStores(), fetchOrders()]);
      setStores(s);
      setAllOrders(o);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const [selYear, selMonth] = selectedMonth.split("-").map(Number);
  const refDate = new Date(selYear, selMonth - 1, 28);

  const thisMonthOrders = allOrders.filter((o) => {
    if (!o.created_at) return false;
    const d = new Date(o.created_at);
    return d.getFullYear() === selYear && d.getMonth() === selMonth - 1;
  });

  const thisMonthRevenue = thisMonthOrders.reduce((sum, o) => sum + (o.subtotal ?? 0), 0);
  const totalMRR = computeMRR(stores);
  const displayMRR = Math.round(totalMRR / 10000);
  const arrEstimate = Math.round((totalMRR * 12) / 100000000 * 100) / 100;
  const avgPerStore = stores.length > 0 ? Math.round(totalMRR / stores.length) : 0;

  const planBreakdown = computePlanBreakdown(stores);

  const monthlyOrderData = groupByMonth(allOrders, 7, refDate);
  const monthlyRevenueData = groupRevenueByMonth(allOrders, 7, refDate);

  const monthlyRevenue = monthlyRevenueData.map((m) => ({
    month: m.month,
    revenue: Math.round(m.revenue / 10000),
  }));

  const mrrByMonth = groupByMonth(stores, 7, refDate).map((m, i) => {
    const storeCountAtMonth = stores.filter((s) => {
      if (!s.created_at) return true;
      const d = new Date(s.created_at);
      return d <= new Date(m.year, m.m + 1, 0);
    }).length;
    return {
      month: m.month,
      value: Math.round(storeCountAtMonth * (avgPerStore || 58000) / 10000),
    };
  });

  const momGrowth = monthlyRevenue.map((m, i) => {
    if (i === 0) return { month: m.month, rate: 0 };
    const prev = monthlyRevenue[i - 1].revenue;
    const cur = m.revenue;
    return {
      month: m.month,
      rate: prev > 0 ? Number((((cur - prev) / prev) * 100).toFixed(1)) : 0,
    };
  });

  const dateLabel = `${selYear}年${selMonth}月期`;

  const kpis = [
    {
      label: "今月のMRR",
      value: `¥${displayMRR.toLocaleString()}万`,
      sub: `${stores.length}店舗の合計`,
      subColor: "text-green-600",
      icon: DollarSign,
    },
    {
      label: "年間ARR予測",
      value: `¥${arrEstimate}億`,
      sub: "現在のMRRで試算",
      subColor: "text-gray-500",
      icon: null,
    },
    {
      label: "月間注文売上",
      value: `¥${Math.round(thisMonthRevenue / 10000).toLocaleString()}万`,
      sub: `${thisMonthOrders.length}件の注文合計`,
      subColor: "text-gray-500",
      icon: null,
    },
    {
      label: "平均客単価",
      value: thisMonthOrders.length > 0
        ? `¥${Math.round(thisMonthRevenue / thisMonthOrders.length).toLocaleString()}`
        : "¥0",
      sub: "店舗注文の平均",
      subColor: "text-gray-500",
      icon: null,
    },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[60vh]">
        <Loader2 className="w-8 h-8 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <>
      <header className="bg-[#FFF9C4] px-6 py-4 border-b border-yellow-200 flex items-center justify-between">
        <div>
          <h1 className="text-lg font-bold text-gray-900">収益分析</h1>
          <p className="text-xs text-gray-600">{dateLabel}</p>
        </div>
        <input
          type="month"
          value={selectedMonth}
          onChange={(e) => setSelectedMonth(e.target.value)}
          className="border border-gray-300 rounded-lg px-3 py-1.5 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400"
        />
      </header>

      <div className="p-6 space-y-6">
        <div className="grid grid-cols-4 gap-4">
          {kpis.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 }}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                {kpi.icon && <kpi.icon className="w-3.5 h-3.5" />}
                {kpi.label}
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className={`text-xs mt-1 flex items-center gap-1 ${kpi.subColor}`}>
                {kpi.subColor === "text-green-600" && (
                  <TrendingUp className="w-3 h-3" />
                )}
                {kpi.sub}
              </p>
            </motion.div>
          ))}
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
          className="bg-white rounded-xl border border-gray-200 p-6"
        >
          <h2 className="font-bold text-sm mb-4">月次注文売上推移（万円）</h2>
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyRevenue}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => [`¥${value.toLocaleString()}万`, "売上"]} />
              <Bar dataKey="revenue" fill="#F59E0B" radius={[4, 4, 0, 0]} name="売上（万円）" />
            </BarChart>
          </ResponsiveContainer>
        </motion.div>

        <div className="grid grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl border border-gray-200 p-6"
          >
            <h2 className="font-bold text-sm mb-4">プラン別収益内訳</h2>
            <div className="flex items-center justify-center">
              <ResponsiveContainer width="100%" height={220}>
                <PieChart>
                  <Pie
                    data={planBreakdown}
                    cx="50%"
                    cy="50%"
                    innerRadius={50}
                    outerRadius={90}
                    dataKey="value"
                    label={({ name, value }) => `${name} ${value}%`}
                    labelLine={false}
                  >
                    {planBreakdown.map((entry) => (
                      <Cell key={entry.name} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
            </div>
            <div className="space-y-2 mt-4">
              {planBreakdown.map((plan) => (
                <div
                  key={plan.name}
                  className="flex items-center justify-between text-xs"
                >
                  <div className="flex items-center gap-2">
                    <div
                      className="w-3 h-3 rounded-sm"
                      style={{ backgroundColor: plan.color }}
                    />
                    <span className="font-medium">{plan.name}</span>
                  </div>
                  <span className="text-gray-500">
                    &yen;{plan.amount}万 ({plan.stores}店舗)
                  </span>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white rounded-xl border border-gray-200 p-6"
          >
            <h2 className="font-bold text-sm mb-4">月次注文件数推移</h2>
            <ResponsiveContainer width="100%" height={280}>
              <BarChart data={monthlyOrderData.map((m) => ({ month: m.month, value: m.count }))}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#F59E0B" radius={[4, 4, 0, 0]} name="注文件数" />
              </BarChart>
            </ResponsiveContainer>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.4 }}
          className="bg-white rounded-xl border border-gray-200 p-6"
        >
          <h2 className="font-bold text-sm mb-4">MRR推移（万円）</h2>
          <ResponsiveContainer width="100%" height={250}>
            <LineChart data={mrrByMonth}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} />
              <XAxis dataKey="month" tick={{ fontSize: 12 }} />
              <YAxis tick={{ fontSize: 12 }} />
              <Tooltip formatter={(value: number) => [`¥${value.toLocaleString()}万`, "MRR"]} />
              <Line
                type="monotone"
                dataKey="value"
                stroke="#F59E0B"
                strokeWidth={2}
                dot={{ fill: "#F59E0B", r: 4 }}
                activeDot={{ r: 6 }}
              />
            </LineChart>
          </ResponsiveContainer>
        </motion.div>
      </div>
    </>
  );
}
