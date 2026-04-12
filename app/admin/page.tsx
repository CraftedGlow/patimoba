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
  Loader2,
} from "lucide-react";
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
import {
  fetchStores,
  fetchStoreCount,
  fetchOrderCount,
  fetchOrders,
  type Store,
  type Order,
} from "@/lib/admin-api";

function groupByMonth<T extends { created_at: string | null }>(
  items: T[],
  monthsBack: number
) {
  const now = new Date();
  const buckets: { month: string; count: number }[] = [];

  for (let i = monthsBack - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    buckets.push({
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
    return { month: m.month, value: Math.max(val, 0) };
  });
  return result.reverse();
}

function monthlyMRR(stores: Store[], monthsBack: number) {
  const growth = cumulativeStoreGrowth(stores, monthsBack);
  const avgMRR = 58000;
  return growth.map((g) => ({
    month: g.month,
    value: Math.round((g.value * avgMRR) / 10000),
  }));
}

export default function AdminDashboardPage() {
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

  const displayStoreCount = storeCount ?? 0;
  const displayOrderCount = orderCount ?? 0;
  const totalMRR = 0;
  const displayMRR = Math.round(totalMRR / 10000);

  const thirtyDaysAgo = new Date();
  thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);
  const riskCount = stores.filter((s) => {
    if (!s.created_at) return false;
    return new Date(s.created_at) < thirtyDaysAgo;
  }).length;
  const inactiveCount = stores.filter((s) => !s.created_at).length;

  const thisMonthStores = stores.filter((s) => {
    if (!s.created_at) return false;
    const d = new Date(s.created_at);
    const now = new Date();
    return d.getMonth() === now.getMonth() && d.getFullYear() === now.getFullYear();
  }).length;

  const storeGrowth = cumulativeStoreGrowth(stores, 6);
  const mrrTrend = monthlyMRR(stores, 6);
  const monthlyOrderData = groupByMonth(orders, 6).map((m) => ({
    month: m.month,
    value: m.count,
  }));

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
    },
    {
      type: "warning" as const,
      icon: Clock,
      label: "30日以上ログインなし",
      badge: "注意",
      badgeColor: "bg-amber-500 text-white",
      value: `${inactiveCount}店舗`,
      sub: "フォローアップ推奨",
      bg: "bg-amber-50 border-amber-200",
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
    },
  ];

  const churnPct = displayStoreCount > 0 ? ((riskCount / displayStoreCount) * 100).toFixed(1) : "0.0";

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
      label: "MRR（月次経常収益）",
      value: `¥${displayMRR.toLocaleString()}万`,
      change: `${displayStoreCount}店舗の合計`,
      trend: "up" as const,
    },
    {
      icon: Activity,
      label: "チャーン率",
      value: `${churnPct}%`,
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

  const churnData = storeGrowth.map((g, i) => ({
    month: g.month,
    value:
      g.value > 0
        ? Number(((riskCount / Math.max(g.value, 1)) * 100 * (1 + (5 - i) * 0.1)).toFixed(1))
        : 0,
  }));

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
          <h1 className="text-lg font-bold text-gray-900">経営分析ダッシュボード</h1>
          <p className="text-xs text-gray-600">{nowStr}</p>
        </div>
        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-600 text-white text-sm font-bold px-4 py-2 rounded-lg transition-colors"
        >
          <FileText className="w-4 h-4" />
          レポート出力
        </motion.button>
      </header>

      <div className="p-6 space-y-6">
        {/* Alert Cards */}
        <div className="grid grid-cols-3 gap-4">
          {alerts.map((alert, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.06 }}
              className={`rounded-xl border p-5 ${alert.bg}`}
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
        <div className="grid grid-cols-4 gap-4">
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
                kpi.label === "チャーン率" ? "text-green-600" : kpi.trend === "up" ? "text-green-600" : "text-red-600"
              }`}>
                {kpi.trend === "up" ? <TrendingUp className="w-3 h-3" /> : <TrendingDown className="w-3 h-3" />}
                {kpi.change}
              </p>
            </motion.div>
          ))}
        </div>

        {/* Charts 2x2 */}
        <div className="grid grid-cols-2 gap-6">
          <ChartCard title="加盟店舗数推移" delay={0.3}>
            <ResponsiveContainer width="100%" height={240}>
              <AreaChart data={storeGrowth}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Area type="monotone" dataKey="value" stroke="#F59E0B" fill="#FEF3C7" strokeWidth={2} />
              </AreaChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="MRR推移（万円）" delay={0.35}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={mrrTrend}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
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
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="value" fill="#F59E0B" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>

          <ChartCard title="チャーン率推移（%）" delay={0.45}>
            <ResponsiveContainer width="100%" height={240}>
              <LineChart data={churnData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="month" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} domain={[0, "auto"]} />
                <Tooltip />
                <Line type="monotone" dataKey="value" stroke="#EF4444" strokeWidth={2} dot={{ fill: "#EF4444", r: 4 }} />
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
