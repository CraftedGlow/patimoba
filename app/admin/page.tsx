"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import {
  TriangleAlert as AlertTriangle,
  TrendingUp,
  TrendingDown,
  Building2,
  DollarSign,
  Activity,
  ShoppingCart,
  Clock,
  Users,
  FileText,
} from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import {
  AreaChart,
  Area,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";
import { useRouter } from "next/navigation";
import {
  fetchStores,
  fetchStoreCount,
  fetchOrderCount,
  fetchOrders,
  type Store,
  type Order,
} from "@/lib/admin-api";
import { totalMrrYen, mrrYenForStorePlan, normalizeStorePlan } from "@/lib/store-plans";

const PLAN_LABELS: Record<string, string> = {
  light: "ライト",
  standard: "スタンダード",
  premium: "プレミアム",
};

function groupByMonth<T extends { created_at: string | null }>(
  items: T[],
  monthsBack: number
) {
  const now = new Date();
  const buckets: { key: string; month: string; count: number }[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
      key: `${d.getFullYear()}-${d.getMonth() + 1}`,
      month: `${d.getMonth() + 1}月`,
      count: 0,
    });
  }

  for (const item of items) {
    if (!item.created_at) continue;
    const d = new Date(item.created_at);
    const diff =
      (now.getFullYear() - d.getFullYear()) * 12 + (now.getMonth() - d.getMonth());
    if (diff >= 0 && diff < monthsBack) {
      buckets[monthsBack - 1 - diff].count++;
    }
  }
  return buckets;
}

function cumulativeStoreGrowth(stores: Store[], monthsBack: number) {
  const monthly = groupByMonth(stores, monthsBack);
  const total = stores.length;
  let cum = total;
  const result = [...monthly].reverse().map((m) => {
    const val = cum;
    cum -= m.count;
    return { key: m.key, month: m.month, value: Math.max(val, 0) };
  });
  return result.reverse();
}

function monthlyMRR(stores: Store[], monthsBack: number) {
  const now = new Date();
  const result: { key: string; month: string; value: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const storesByThen = stores.filter(
      (s) => !s.created_at || new Date(s.created_at) <= monthEnd
    );
    result.push({
      key: `${d.getFullYear()}-${d.getMonth() + 1}`,
      month: `${d.getMonth() + 1}月`,
      value: Math.round(totalMrrYen(storesByThen) / 10000),
    });
  }
  return result;
}

function monthlyActivityRate(stores: Store[], orders: Order[], monthsBack: number) {
  const now = new Date();
  const result: { key: string; month: string; value: number }[] = [];
  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const monthEnd = new Date(d.getFullYear(), d.getMonth() + 1, 0, 23, 59, 59);
    const storesByThen = stores.filter(
      (s) => !s.created_at || new Date(s.created_at) <= monthEnd
    ).length;
    const activeStoreIds = new Set(
      orders
        .filter((o) => {
          if (!o.created_at) return false;
          const od = new Date(o.created_at);
          return od.getFullYear() === d.getFullYear() && od.getMonth() === d.getMonth();
        })
        .map((o) => o.store_id)
    );
    result.push({
      key: `${d.getFullYear()}-${d.getMonth() + 1}`,
      month: `${d.getMonth() + 1}月`,
      value: storesByThen > 0 ? Number(((activeStoreIds.size / storesByThen) * 100).toFixed(1)) : 0,
    });
  }
  return result;
}

export default function AdminDashboardPage() {
  const router = useRouter();
  const [stores, setStores] = useState<Store[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [storeCount, setStoreCount] = useState<number | null>(null);
  const [orderCount, setOrderCount] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);

  const loadStats = useCallback(async () => {
    try {
      const [count, oCount, allStores, allOrders] = await Promise.all([
        fetchStoreCount(),
        fetchOrderCount(),
        fetchStores(),
        fetchOrders(),
      ]);
      setStoreCount(count);
      setOrderCount(oCount);
      setStores(allStores);
      setOrders(allOrders);
    } catch {
      setStoreCount(0);
      setOrderCount(0);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    loadStats();
  }, [loadStats]);

  const handleExportReport = () => {
    const orderCountByStore = new Map<string, number>();
    for (const o of orders) {
      if (!o.store_id) continue;
      orderCountByStore.set(o.store_id, (orderCountByStore.get(o.store_id) ?? 0) + 1);
    }
    const header = ["店舗名", "プラン", "MRR（円）", "稼働状況", "登録日", "累計注文件数"];
    const rows = stores.map((s) => [
      s.name ?? "",
      PLAN_LABELS[normalizeStorePlan(s.plan)] ?? PLAN_LABELS.light,
      String(mrrYenForStorePlan(s.plan)),
      s.is_active === false ? "リスク" : "稼働中",
      s.created_at ? new Date(s.created_at).toLocaleDateString("ja-JP") : "",
      String(orderCountByStore.get(s.id) ?? 0),
    ]);
    const csv = [header, ...rows]
      .map((r) => r.map((v) => `"${String(v).replace(/"/g, '""')}"`).join(","))
      .join("\r\n");
    const blob = new Blob(["﻿" + csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    const today = new Date();
    const dateStr = `${today.getFullYear()}${String(today.getMonth() + 1).padStart(2, "0")}${String(today.getDate()).padStart(2, "0")}`;
    a.href = url;
    a.download = `patimoba-report-${dateStr}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  };

  const displayStoreCount = storeCount ?? 0;
  const displayOrderCount = orderCount ?? 0;
  const totalMRR = totalMrrYen(stores);
  const displayMRR = Math.round(totalMRR / 10000);

  const riskCount = stores.filter((s) => s.is_active === false).length;

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const lastOrderByStore = new Map<string, Date>();
  for (const o of orders) {
    if (!o.store_id || !o.created_at) continue;
    const d = new Date(o.created_at);
    const prev = lastOrderByStore.get(o.store_id);
    if (!prev || d > prev) lastOrderByStore.set(o.store_id, d);
  }
  const noRecentOrderCount = stores.filter((s) => {
    if (s.is_active === false) return false;
    const last = lastOrderByStore.get(s.id);
    return !last || last < thirtyDaysAgo;
  }).length;

  const thisMonthStores = stores.filter((s) => {
    if (!s.created_at) return false;
    const d = new Date(s.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const storeGrowth = cumulativeStoreGrowth(stores, 6);
  const mrrTrend = monthlyMRR(stores, 6);
  const monthlyOrderData = groupByMonth(orders, 6).map((m) => ({
    key: m.key,
    month: m.month,
    value: m.count,
  }));
  const activityRateData = monthlyActivityRate(stores, orders, 6);

  const now = new Date();
  const nowStr = `${now.getFullYear()}年${now.getMonth() + 1}月${now.getDate()}日 更新`;

  const alerts = [
    {
      type: "danger" as const,
      icon: AlertTriangle,
      label: "解約リスク店舗",
      badge: "高",
      badgeColor: "bg-red-500 text-white",
      value: `${riskCount}店舗`,
      sub: "クリックで一覧表示",
      bg: "bg-red-50 border-red-200",
      onClick: () => router.push("/admin/stores?status=risk"),
    },
    {
      type: "warning" as const,
      icon: Clock,
      label: "30日以上受注なし",
      badge: "注意",
      badgeColor: "bg-amber-500 text-white",
      value: `${noRecentOrderCount}店舗`,
      sub: "フォローアップ推奨",
      bg: "bg-amber-50 border-amber-200",
      onClick: undefined as (() => void) | undefined,
    },
    {
      type: "info" as const,
      icon: Users,
      label: "今月の加盟状況",
      badge: "",
      badgeColor: "",
      value: "",
      sub: "",
      bg: "bg-white border-gray-200",
      custom: true,
      onClick: undefined as (() => void) | undefined,
    },
  ];

  const riskPct = displayStoreCount > 0 ? ((riskCount / displayStoreCount) * 100).toFixed(1) : "0.0";

  const kpis = [
    {
      icon: Building2,
      label: "総加盟店舗数",
      value: `${displayStoreCount.toLocaleString()}店舗`,
      change: `今月 +${thisMonthStores}店舗`,
      trend: "up" as const,
    },
    {
      icon: DollarSign,
      label: "MRR（月次経常収益:万円）",
      value: displayMRR.toLocaleString(),
      change: `${displayStoreCount}店舗の合計`,
      trend: "up" as const,
    },
    {
      icon: Activity,
      label: "リスク店舗比率",
      value: `${riskPct}%`,
      change: `リスク ${riskCount}店舗`,
      trend: "down" as const,
    },
    {
      icon: ShoppingCart,
      label: "全店舗合計注文件数",
      value: `${displayOrderCount.toLocaleString()}件`,
      change: "累計注文件数",
      trend: "up" as const,
    },
  ];

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
          <h1 className="text-base sm:text-lg font-bold text-gray-900">経営分析ダッシュボード</h1>
          <p className="text-xs text-gray-600">{nowStr}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleExportReport}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-3 sm:px-4 py-2 rounded-lg transition-colors"
        >
          <FileText className="w-4 h-4" />
          <span className="hidden sm:inline">レポート出力</span>
        </motion.button>
      </header>

      <div className="p-4 sm:p-6 space-y-4 sm:space-y-6">
        {/* Alert Cards */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          {alerts.map((alert, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              onClick={alert.onClick}
              className={`rounded-xl border p-5 ${alert.bg} ${alert.onClick ? "cursor-pointer hover:shadow-sm transition-shadow" : ""}`}
            >
              {alert.custom ? (
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <Users className="w-4 h-4 text-gray-500" />
                    <span className="text-sm font-medium">今月の加盟状況</span>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <p className="text-xs text-gray-500">新規加盟</p>
                      <p className="text-2xl font-bold text-green-600">+{thisMonthStores}</p>
                    </div>
                    <div>
                      <p className="text-xs text-gray-500">解約リスク</p>
                      <p className="text-2xl font-bold text-red-500">{riskCount}</p>
                    </div>
                  </div>
                </div>
              ) : (
                <>
                  <div className="flex items-center justify-between mb-3">
                    <div className="flex items-center gap-2">
                      <alert.icon className="w-4 h-4 text-gray-500" />
                      <span className="text-sm font-medium">{alert.label}</span>
                    </div>
                    {alert.badge && (
                      <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${alert.badgeColor}`}>
                        {alert.badge}
                      </span>
                    )}
                  </div>
                  <p className="text-2xl font-bold">{alert.value}</p>
                  <p className="text-xs text-gray-500 mt-1">{alert.sub}</p>
                </>
              )}
            </motion.div>
          ))}
        </div>

        {/* KPI Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
          {kpis.map((kpi, i) => (
            <motion.div
              key={kpi.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.05 + 0.2 }}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              <div className="flex items-center gap-1.5 text-xs text-gray-500 mb-2">
                <kpi.icon className="w-3.5 h-3.5" />
                {kpi.label}
              </div>
              <p className="text-2xl font-bold">{kpi.value}</p>
              <p className={`text-xs mt-1 flex items-center gap-1 ${
                kpi.label === "リスク店舗比率" ? "text-green-600" : kpi.trend === "up" ? "text-green-600" : "text-red-600"
              }`}>
                {kpi.trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {kpi.change}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Charts 2x2 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4 sm:gap-6">
          <ChartCard title="加盟店舗数推移" delay={0.3}>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={storeGrowth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="key" tickFormatter={(v: string) => `${Number(v.split("-")[1])}月`} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#F59E0B" fill="#FEF3C7" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="MRR推移（月次経常収益:万円）" delay={0.35}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={mrrTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="key" tickFormatter={(v: string) => `${Number(v.split("-")[1])}月`} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#F59E0B" strokeWidth={2} dot={{ fill: "#F59E0B", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="月次注文件数推移" delay={0.4}>
            <ResponsiveContainer width="100%" height={240}>
              <BarChart data={monthlyOrderData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="key" tickFormatter={(v: string) => `${Number(v.split("-")[1])}月`} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="月次稼働率推移（受注あり店舗の割合:%）" delay={0.45}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={activityRateData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="key" tickFormatter={(v: string) => `${Number(v.split("-")[1])}月`} tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, 100]} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#10B981" strokeWidth={2} dot={{ fill: "#10B981", r: 4 }} />
              </LineChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>
      </div>
    </>
  );
}

function ChartCard({ title, delay, children }: { title: string; delay: number; children: React.ReactNode }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
      className="bg-white rounded-xl border border-gray-200 p-6"
    >
      <h2 className="font-bold text-sm mb-4">{title}</h2>
      {children}
    </motion.div>
  );
}
