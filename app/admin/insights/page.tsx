"use client";

import { useEffect, useState, useCallback } from "react";
import { motion } from "framer-motion";
import { Clock, ShoppingCart, Target, Loader2, TrendingUp } from "lucide-react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  fetchOrders,
  fetchStores,
  fetchLineItems,
  computeMRR,
  type Order,
  type Store,
} from "@/lib/admin-api";

function formatDate(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function getDefaultRange(): [string, string] {
  const now = new Date();
  const from = new Date(now.getFullYear(), now.getMonth(), 1);
  return [formatDate(from), formatDate(now)];
}

function parseHour(dateStr: string | null): number {
  if (!dateStr) return 12;
  const d = new Date(dateStr);
  return d.getHours();
}

const TIME_SLOTS = [
  { label: "6-9時", min: 6, max: 9 },
  { label: "9-12時", min: 9, max: 12 },
  { label: "12-15時", min: 12, max: 15 },
  { label: "15-18時", min: 15, max: 18 },
  { label: "18-21時", min: 18, max: 21 },
  { label: "21-6時", min: 21, max: 6 },
];

function buildTimeDistribution(orders: Order[]) {
  const counts = TIME_SLOTS.map((s) => ({ time: s.label, orders: 0 }));
  for (const o of orders) {
    const h = parseHour(o.created_date);
    for (let i = 0; i < TIME_SLOTS.length; i++) {
      const slot = TIME_SLOTS[i];
      if (slot.min < slot.max) {
        if (h >= slot.min && h < slot.max) { counts[i].orders++; break; }
      } else {
        if (h >= slot.min || h < slot.max) { counts[i].orders++; break; }
      }
    }
  }
  return counts;
}

function buildDayOfWeekDistribution(orders: Order[]) {
  const days = ["日", "月", "火", "水", "木", "金", "土"];
  const counts = days.map((d) => ({ day: d, orders: 0 }));
  for (const o of orders) {
    if (!o.created_date) continue;
    const dow = new Date(o.created_date).getDay();
    counts[dow].orders++;
  }
  return counts;
}

export default function AdminInsightsPage() {
  const [dateFrom, setDateFrom] = useState(() => getDefaultRange()[0]);
  const [dateTo, setDateTo] = useState(() => getDefaultRange()[1]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [stores, setStores] = useState<Store[]>([]);
  const [lineItemCount, setLineItemCount] = useState(0);
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const fromISO = new Date(dateFrom).toISOString();
      const toDate = new Date(dateTo);
      toDate.setHours(23, 59, 59, 999);
      const toISO = toDate.toISOString();

      const [o, s, li] = await Promise.all([
        fetchOrders(fromISO, toISO),
        fetchStores(),
        fetchLineItems(fromISO, toISO),
      ]);
      setOrders(o);
      setStores(s);
      setLineItemCount(li.length);
    } catch {
      /* empty */
    } finally {
      setLoading(false);
    }
  }, [dateFrom, dateTo]);

  useEffect(() => {
    load();
  }, [load]);

  const totalOrders = orders.length;
  const totalRevenue = orders.reduce((sum, o) => sum + (o.subtotal ?? 0), 0);
  const avgOrderValue = totalOrders > 0 ? Math.round(totalRevenue / totalOrders) : 0;
  const totalMRR = computeMRR(stores);

  const timeData = buildTimeDistribution(orders);
  const outsideHoursOrders = (timeData[0]?.orders ?? 0) + (timeData[4]?.orders ?? 0) + (timeData[5]?.orders ?? 0);
  const outsideHoursPct = totalOrders > 0 ? Math.round((outsideHoursOrders / totalOrders) * 100) : 0;

  const dayData = buildDayOfWeekDistribution(orders);

  const customOrders = orders.filter((o) => o.is_custom).length;
  const customPct = totalOrders > 0 ? Math.round((customOrders / totalOrders) * 100) : 0;

  const optionsPerOrder = totalOrders > 0 ? (lineItemCount / totalOrders).toFixed(1) : "0";

  const confirmedOrders = orders.filter((o) => o.order_confirmed).length;
  const confirmRate = totalOrders > 0 ? Math.round((confirmedOrders / totalOrders) * 100) : 0;

  const completedOrders = orders.filter((o) => o.order_completed_at).length;
  const completionRate = totalOrders > 0 ? Math.round((completedOrders / totalOrders) * 100) : 0;

  const radarData = [
    { subject: "注文件数", value: Math.min(totalOrders * 2, 100) },
    { subject: "確認率", value: confirmRate },
    { subject: "完了率", value: completionRate },
    { subject: "カスタム率", value: Math.min(customPct * 2, 100) },
    { subject: "時間外注文", value: Math.min(outsideHoursPct * 2, 100) },
    { subject: "平均単価", value: Math.min(Math.round(avgOrderValue / 100), 100) },
  ];

  const radarScores = [
    { label: "注文件数", value: `${totalOrders}件`, color: "text-gray-900" },
    { label: "確認率", value: `${confirmRate}%`, color: "text-amber-600" },
    { label: "完了率", value: `${completionRate}%`, color: "text-gray-900" },
    { label: "カスタム率", value: `${customPct}%`, color: "text-amber-600" },
    { label: "時間外注文率", value: `${outsideHoursPct}%`, color: "text-gray-900" },
    { label: "平均単価", value: `¥${avgOrderValue.toLocaleString()}`, color: "text-amber-600" },
  ];

  const topMetrics = [
    {
      icon: Clock,
      label: "時間外注文率",
      badge: "営業強み",
      badgeColor: "bg-green-100 text-green-700",
      value: `${outsideHoursPct}%`,
      valueColor: "text-green-600",
      description: `期間内${outsideHoursOrders}件が営業時間外注文`,
      point: "24時間受付で機会損失を防止",
    },
    {
      icon: ShoppingCart,
      label: "平均注文単価",
      badge: "収益",
      badgeColor: "bg-blue-100 text-blue-700",
      value: `¥${avgOrderValue.toLocaleString()}`,
      valueColor: "text-blue-600",
      description: `期間内${totalOrders}件の平均`,
      point: `合計売上: ¥${totalRevenue.toLocaleString()}`,
    },
    {
      icon: Target,
      label: "カスタムケーキ率",
      badge: "単価UP",
      badgeColor: "bg-amber-100 text-amber-700",
      value: `${customPct}%`,
      valueColor: "text-amber-600",
      description: `${customOrders}件がカスタムケーキ注文`,
      point: "カスタマイズで収益を底上げ",
    },
  ];

  const periodLabel = `${dateFrom.replace(/-/g, "/")} 〜 ${dateTo.replace(/-/g, "/")}`;

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
          <h1 className="text-lg font-bold text-gray-900">営業インサイト</h1>
          <p className="text-xs text-gray-600">Supabase実データに基づく分析</p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={dateFrom}
            onChange={(e) => setDateFrom(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
          <span className="text-gray-400">〜</span>
          <input
            type="date"
            value={dateTo}
            onChange={(e) => setDateTo(e.target.value)}
            className="border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-400"
          />
        </div>
      </header>

      <div className="p-6 space-y-6">
        <div className="bg-white rounded-xl border border-gray-200 p-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <TrendingUp className="w-5 h-5 text-amber-500" />
            <div>
              <p className="text-xs text-gray-500">対象期間</p>
              <p className="text-sm font-bold">{periodLabel}</p>
            </div>
          </div>
          <div className="flex items-center gap-6 text-sm">
            <div className="text-center">
              <p className="text-xs text-gray-500">総注文件数</p>
              <p className="font-bold text-lg">{totalOrders.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">総売上</p>
              <p className="font-bold text-lg">¥{totalRevenue.toLocaleString()}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">加盟店舗数</p>
              <p className="font-bold text-lg">{stores.length}</p>
            </div>
            <div className="text-center">
              <p className="text-xs text-gray-500">MRR</p>
              <p className="font-bold text-lg">¥{Math.round(totalMRR / 10000).toLocaleString()}万</p>
            </div>
          </div>
        </div>

        <div className="grid grid-cols-3 gap-4">
          {topMetrics.map((metric, i) => (
            <motion.div
              key={metric.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.08 }}
              className="bg-white rounded-xl border border-gray-200 p-5"
            >
              <div className="flex items-center justify-between mb-3">
                <div className="flex items-center gap-2">
                  <metric.icon className="w-4 h-4 text-gray-500" />
                  <span className="text-sm font-medium">{metric.label}</span>
                </div>
                <span className={`text-xs font-bold px-2 py-0.5 rounded-full ${metric.badgeColor}`}>
                  {metric.badge}
                </span>
              </div>
              <p className={`text-3xl font-bold ${metric.valueColor}`}>{metric.value}</p>
              <p className="text-xs text-gray-500 mt-2">{metric.description}</p>
              <p className="text-xs text-gray-400 mt-1">・{metric.point}</p>
            </motion.div>
          ))}
        </div>

        <div className="grid grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.25 }}
            className="bg-white rounded-xl border border-gray-200 p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Clock className="w-4 h-4 text-gray-500" />
              <h2 className="font-bold text-sm">時間帯別注文分布</h2>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={timeData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="time" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="orders" fill="#F59E0B" radius={[4, 4, 0, 0]} name="注文件数" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">
                <span className="font-bold">営業トークポイント：</span>
                営業時間外でも{outsideHoursPct}%の注文があり、24時間体制の予約受付が機会損失を防ぎます。
              </p>
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
            className="bg-white rounded-xl border border-gray-200 p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <ShoppingCart className="w-4 h-4 text-gray-500" />
              <h2 className="font-bold text-sm">曜日別注文分布</h2>
            </div>
            <ResponsiveContainer width="100%" height={260}>
              <BarChart data={dayData}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} />
                <XAxis dataKey="day" tick={{ fontSize: 12 }} />
                <YAxis tick={{ fontSize: 12 }} />
                <Tooltip />
                <Bar dataKey="orders" fill="#F59E0B" radius={[4, 4, 0, 0]} name="注文件数" />
              </BarChart>
            </ResponsiveContainer>
            <div className="mt-3 bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-600">
                <span className="font-bold">営業トークポイント：</span>
                曜日ごとの注文傾向を把握し、効果的なキャンペーン配信タイミングを提案できます。
              </p>
            </div>
          </motion.div>
        </div>

        <div className="grid grid-cols-2 gap-6">
          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.35 }}
            className="bg-white rounded-xl border border-gray-200 p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-gray-500" />
              <h2 className="font-bold text-sm">注文分析サマリー</h2>
            </div>
            <div className="space-y-4">
              {[
                { name: "カスタムケーキ注文率", rate: customPct, detail: `${customOrders}/${totalOrders}件` },
                { name: "注文確認率", rate: confirmRate, detail: `${confirmedOrders}/${totalOrders}件` },
                { name: "注文完了率", rate: completionRate, detail: `${completedOrders}/${totalOrders}件` },
                { name: "時間外注文率", rate: outsideHoursPct, detail: `${outsideHoursOrders}/${totalOrders}件` },
              ].map((opt) => (
                <div key={opt.name}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-sm font-medium">{opt.name}</span>
                    <span className="text-sm font-bold">{opt.rate}%</span>
                  </div>
                  <div className="w-full bg-gray-100 rounded-full h-2.5">
                    <motion.div
                      initial={{ width: 0 }}
                      animate={{ width: `${Math.min(opt.rate, 100)}%` }}
                      transition={{ duration: 0.8, ease: "easeOut" }}
                      className="h-full bg-amber-400 rounded-full"
                    />
                  </div>
                  <p className="text-xs text-gray-400 mt-0.5">{opt.detail}</p>
                </div>
              ))}
            </div>
          </motion.div>

          <motion.div
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.4 }}
            className="bg-white rounded-xl border border-gray-200 p-6"
          >
            <div className="flex items-center gap-2 mb-4">
              <Target className="w-4 h-4 text-gray-500" />
              <h2 className="font-bold text-sm">営業効果スコア</h2>
            </div>
            <ResponsiveContainer width="100%" height={220}>
              <RadarChart data={radarData}>
                <PolarGrid />
                <PolarAngleAxis dataKey="subject" tick={{ fontSize: 11 }} />
                <PolarRadiusAxis angle={30} domain={[0, 100]} tick={{ fontSize: 10 }} />
                <Radar
                  dataKey="value"
                  stroke="#F59E0B"
                  fill="#FEF3C7"
                  fillOpacity={0.6}
                />
              </RadarChart>
            </ResponsiveContainer>
            <div className="grid grid-cols-2 gap-x-6 gap-y-1 mt-2">
              {radarScores.map((score) => (
                <div
                  key={score.label}
                  className="flex items-center justify-between text-xs"
                >
                  <span className="text-gray-600">{score.label}</span>
                  <span className={`font-bold ${score.color}`}>{score.value}</span>
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.45 }}
          className="bg-white rounded-xl border border-gray-200 p-6"
        >
          <h2 className="font-bold text-sm mb-4">期間内注文詳細</h2>
          <div className="grid grid-cols-4 gap-4">
            {[
              { label: "総注文件数", value: totalOrders.toLocaleString(), unit: "件" },
              { label: "総売上額", value: `¥${totalRevenue.toLocaleString()}`, unit: "" },
              { label: "平均注文単価", value: `¥${avgOrderValue.toLocaleString()}`, unit: "" },
              { label: "商品明細数", value: lineItemCount.toLocaleString(), unit: "件" },
              { label: "1注文あたり明細数", value: optionsPerOrder, unit: "件" },
              { label: "カスタム注文", value: customOrders.toLocaleString(), unit: "件" },
              { label: "確認済み注文", value: confirmedOrders.toLocaleString(), unit: "件" },
              { label: "完了済み注文", value: completedOrders.toLocaleString(), unit: "件" },
            ].map((item) => (
              <div key={item.label} className="text-center p-3 bg-gray-50 rounded-lg">
                <p className="text-xs text-gray-500 mb-1">{item.label}</p>
                <p className="text-lg font-bold">
                  {item.value}
                  {item.unit && <span className="text-sm font-normal text-gray-400">{item.unit}</span>}
                </p>
              </div>
            ))}
          </div>
        </motion.div>
      </div>
    </>
  );
}
