"use client";

import { useState, useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { motion } from "framer-motion";
import { Clock, CalendarDays, MapPin } from "lucide-react";
import Image from "next/image";
import { useAuth } from "@/lib/auth-context";
import { useCustomerContext } from "@/lib/customer-context";
import { toUIStore } from "@/lib/types";
import type { Store } from "@/lib/types";

// ── 当日受付チェック (order-type-modal と同ロジック) ─────────────────────

function formatTime(time: string | null) {
  if (!time) return "";
  return time.slice(0, 5);
}

function toMin(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

interface SameDayStatus {
  available: boolean;
  reason: "ok" | "closed_today" | "outside_hours" | "no_schedule";
  acceptStart: string | null;
  acceptEnd: string | null;
}

function minutesToTimeStr(m: number): string {
  const wrapped = ((m % 1440) + 1440) % 1440;
  return `${String(Math.floor(wrapped / 60)).padStart(2, "0")}:${String(wrapped % 60).padStart(2, "0")}`;
}

function checkTimeWindow(
  cutoffMin: number,
  openTime: string | null,
  closeTime: string | null,
  now: Date,
  setStatus: (s: SameDayStatus) => void
) {
  if (!openTime || !closeTime) {
    setStatus({ available: false, reason: "no_schedule", acceptStart: null, acceptEnd: null });
    return;
  }
  const [oh, om] = openTime.split(":").map(Number);
  const [ch, cm] = closeTime.split(":").map(Number);
  let openMinutes = oh * 60 + om;
  let closeMinutes = ch * 60 + cm;
  if (closeMinutes <= openMinutes) closeMinutes += 1440;
  const acceptEndMinutes = closeMinutes - cutoffMin;
  let nowMinutes = now.getHours() * 60 + now.getMinutes();
  if (nowMinutes < openMinutes && nowMinutes < closeMinutes - 1440 + 1440) {
    if (openMinutes > 720 && nowMinutes < 720) nowMinutes += 1440;
  }
  const acceptEndStr = minutesToTimeStr(acceptEndMinutes);
  const acceptStartStr = formatTime(openTime);
  if (nowMinutes >= openMinutes && nowMinutes <= acceptEndMinutes) {
    setStatus({ available: true, reason: "ok", acceptStart: acceptStartStr, acceptEnd: acceptEndStr });
  } else {
    setStatus({ available: false, reason: "outside_hours", acceptStart: acceptStartStr, acceptEnd: acceptEndStr });
  }
}

function useSameDayAvailability(store: Store | null): SameDayStatus {
  const [status, setStatus] = useState<SameDayStatus>({
    available: false,
    reason: "no_schedule",
    acceptStart: null,
    acceptEnd: null,
  });

  useEffect(() => {
    if (!store) return;
    const check = async () => {
      const { supabase } = await import("@/lib/supabase");
      const now = new Date();
      const fmtKey = (d: Date) =>
        `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
      const todayKey = fmtKey(now);
      const todayDow = now.getDay();
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = fmtKey(yesterday);
      const yesterdayDow = yesterday.getDay();

      const { data: hours } = await supabase
        .from("store_business_hours")
        .select("day_of_week, is_closed, open_time, close_time")
        .eq("store_id", store.id);

      const hoursMap = new Map<number, { is_closed: boolean; open_time: string | null; close_time: string | null }>();
      (hours || []).forEach((h: any) => hoursMap.set(h.day_of_week, h));

      const { data: orderRules } = await supabase
        .from("store_order_rules")
        .select("default_lead_time_minutes")
        .eq("store_id", store.id)
        .maybeSingle();

      const cutoffMinutes = orderRules?.default_lead_time_minutes ?? 60;
      const todayHours = hoursMap.get(todayDow);
      const defaultOpen = todayHours?.open_time ?? null;
      const defaultClose = todayHours?.close_time ?? null;
      const isOvernightStore =
        defaultOpen && defaultClose && toMin(defaultOpen) > toMin(defaultClose);

      if (isOvernightStore && now.getHours() < 12) {
        const { data: yesterdaySpecial } = await supabase
          .from("store_special_dates")
          .select("is_closed, open_time, close_time")
          .eq("store_id", store.id)
          .eq("target_date", yesterdayKey)
          .maybeSingle();
        if (yesterdaySpecial) {
          if (!yesterdaySpecial.is_closed) {
            checkTimeWindow(cutoffMinutes, yesterdaySpecial.open_time || defaultOpen, yesterdaySpecial.close_time || defaultClose, now, setStatus);
            return;
          }
        } else {
          const yHours = hoursMap.get(yesterdayDow);
          if (!yHours?.is_closed) {
            checkTimeWindow(cutoffMinutes, yHours?.open_time ?? defaultOpen, yHours?.close_time ?? defaultClose, now, setStatus);
            return;
          }
        }
      }

      const { data: todaySpecial } = await supabase
        .from("store_special_dates")
        .select("is_closed, open_time, close_time")
        .eq("store_id", store.id)
        .eq("target_date", todayKey)
        .maybeSingle();

      if (todaySpecial) {
        if (todaySpecial.is_closed) {
          setStatus({ available: false, reason: "closed_today", acceptStart: null, acceptEnd: null });
          return;
        }
        checkTimeWindow(cutoffMinutes, todaySpecial.open_time || defaultOpen, todaySpecial.close_time || defaultClose, now, setStatus);
        return;
      }

      if (todayHours?.is_closed) {
        setStatus({ available: false, reason: "closed_today", acceptStart: null, acceptEnd: null });
        return;
      }
      checkTimeWindow(cutoffMinutes, defaultOpen, defaultClose, now, setStatus);
    };
    check();
  }, [store?.id]);

  return status;
}

// ── 営業時間ヘルパー ────────────────────────────────────────────────────

const WEEKDAY_LABELS = ["日", "月", "火", "水", "木", "金", "土"];

interface BusinessHour {
  day_of_week: number;
  is_closed: boolean;
  open_time: string | null;
  close_time: string | null;
}

function formatHoursLine(hours: BusinessHour[]): string {
  if (hours.length === 0) return "";
  const openDays = hours.filter((h) => !h.is_closed && h.open_time && h.close_time);
  if (openDays.length === 0) return "定休日";

  // 最も多いパターンを代表として使用
  const counts = new Map<string, number>();
  openDays.forEach((h) => {
    const key = `${h.open_time!.slice(0, 5)}〜${h.close_time!.slice(0, 5)}`;
    counts.set(key, (counts.get(key) || 0) + 1);
  });
  let pattern = "";
  let max = 0;
  counts.forEach((c, k) => { if (c > max) { max = c; pattern = k; } });

  const closedDays = hours
    .filter((h) => h.is_closed)
    .sort((a, b) => a.day_of_week - b.day_of_week)
    .map((h) => `${WEEKDAY_LABELS[h.day_of_week]}曜`);

  return closedDays.length > 0
    ? `${pattern}（${closedDays.join("・")}定休）`
    : pattern;
}

// ── メインページ ─────────────────────────────────────────────────────────

export default function StorePage({ params }: { params: { storeId: string } }) {
  const router = useRouter();
  const { user, loading: authLoading } = useAuth();
  const { setSelectedStoreId, setSelectedStoreName, addViewedStore } = useCustomerContext();

  const [progress, setProgress] = useState(0);
  const [loginDone, setLoginDone] = useState(false);
  const animStarted = useRef(false);

  const [store, setStore] = useState<Store | null>(null);
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);

  const sameDayStatus = useSameDayAvailability(loginDone ? store : null);
  const sameDayOk = sameDayStatus.available;

  // 認証確認後にアニメーション要否を決定
  useEffect(() => {
    if (authLoading) return;
    if (user) {
      // ログイン済みならアニメーションをスキップ
      setLoginDone(true);
      return;
    }
    // 未ログイン時のみアニメーション開始（1回だけ）
    if (animStarted.current) return;
    animStarted.current = true;
    const timer = setInterval(() => {
      setProgress((prev) => {
        if (prev >= 100) { clearInterval(timer); return 100; }
        return prev + 4;
      });
    }, 60);
    return () => clearInterval(timer);
  }, [authLoading, user]);

  useEffect(() => {
    if (progress !== 100) return;
    const t = setTimeout(() => setLoginDone(true), 600);
    return () => clearTimeout(t);
  }, [progress]);

  // 店舗情報フェッチ
  useEffect(() => {
    const fetchData = async () => {
      const { supabase } = await import("@/lib/supabase");
      const [{ data: storeRow }, { data: hours }] = await Promise.all([
        supabase.from("stores").select("*").eq("id", params.storeId).maybeSingle(),
        supabase
          .from("store_business_hours")
          .select("day_of_week, is_closed, open_time, close_time")
          .eq("store_id", params.storeId)
          .order("day_of_week"),
      ]);
      if (storeRow) {
        const uiStore = toUIStore(storeRow);
        setStore(uiStore);
        setSelectedStoreId(uiStore.id);
        setSelectedStoreName(uiStore.name);
        addViewedStore(uiStore.id);
      }
      setBusinessHours(hours || []);
    };
    fetchData();
  }, [params.storeId]);

  const handleSameDay = () => {
    router.push(`/customer/takeout/products?store=${params.storeId}&type=sameday`);
  };

  const handleReservation = () => {
    router.push(`/customer/takeout/products?store=${params.storeId}&type=reservation`);
  };

  // LINEログイン中画面
  if (!loginDone) {
    return (
      <div className="min-h-screen bg-white flex flex-col">
        <div className="bg-[#FFF9C4] h-2.5 shrink-0" aria-hidden />
        <div className="flex-1 flex flex-col items-center justify-center px-8">
          <motion.div
            initial={{ opacity: 0, y: -16 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
            className="mb-10"
          >
            <Image
              src="/スクリーンショット_2026-04-09_14.49.59.png"
              alt="パティモバ"
              width={280}
              height={80}
              className="h-14 w-auto"
              priority
            />
          </motion.div>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.2, duration: 0.4 }}
            className="w-full max-w-xs text-center"
          >
            <h2 className="text-xl font-bold text-gray-900 mb-6">LINEログイン中...</h2>
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden mb-3 shadow-inner">
              <motion.div
                className="h-full rounded-full bg-[#F9A825]"
                initial={{ width: "0%" }}
                animate={{ width: `${progress}%` }}
                transition={{ duration: 0.08 }}
              />
            </div>
            <p className="text-lg font-bold text-gray-900">{progress}%</p>
          </motion.div>
        </div>
      </div>
    );
  }

  // 店舗TOPページ
  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* 店舗情報セクション */}
      {store && (
        <div className="border-b border-gray-100">
          {/* ヒーロー画像 */}
          <div className="w-full h-52 overflow-hidden bg-gray-100">
            {store.image ? (
              <img src={store.image} alt={store.name} className="w-full h-full object-cover" />
            ) : (
              <div className="w-full h-full flex items-center justify-center bg-amber-50">
                {store.logoUrl && (
                  <img src={store.logoUrl} alt={store.name} className="h-20 w-auto object-contain opacity-40" />
                )}
              </div>
            )}
          </div>

          {/* 店舗名・詳細 */}
          <div className="px-4 pt-3 pb-4 space-y-2">
            <h1 className="text-xl font-bold text-gray-900 leading-snug">{store.name}</h1>

            <div className="space-y-1.5">
              {/* 住所 */}
              {store.address && (
                <div className="flex items-start gap-2 text-sm text-gray-500">
                  <MapPin className="w-4 h-4 mt-0.5 shrink-0 text-gray-400" />
                  <span>
                    {store.postalCode && `〒${store.postalCode} `}
                    {store.address}
                    {store.building && ` ${store.building}`}
                  </span>
                </div>
              )}

              {/* 営業時間（1行サマリー） */}
              {businessHours.length > 0 && (
                <div className="flex items-center gap-2 text-sm text-gray-500">
                  <Clock className="w-4 h-4 shrink-0 text-gray-400" />
                  <span>{formatHoursLine(businessHours)}</span>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* 注文タイプ選択 */}
      <div className="px-4 pt-5 pb-8 flex-1">
        <h2 className="text-base font-bold text-gray-900 text-center leading-snug">
          ご注文方法を選択してください
        </h2>
        <p className="text-xs text-gray-400 text-center mt-1 mb-5">
          シーンに合わせてお選びいただけます
        </p>

        {/* 当日受取注文 */}
        <button
          onClick={sameDayOk ? handleSameDay : undefined}
          disabled={!sameDayOk}
          className={`w-full border rounded-xl p-4 mb-3 text-left transition-shadow ${
            sameDayOk
              ? "border-gray-200 hover:shadow-md bg-white active:bg-gray-50"
              : "border-gray-200 bg-white cursor-default"
          }`}
        >
          <div className="flex items-center gap-3 mb-1.5">
            <div className={`w-8 h-8 rounded-full flex items-center justify-center shrink-0 ${sameDayOk ? "bg-amber-100" : "bg-gray-100"}`}>
              <Clock className={`w-4 h-4 ${sameDayOk ? "text-amber-500" : "text-gray-400"}`} />
            </div>
            <span className={`text-sm font-bold ${sameDayOk ? "text-gray-900" : "text-gray-400"}`}>
              当日受取注文
            </span>
          </div>
          <p className={`text-xs leading-relaxed ${sameDayOk ? "text-gray-500" : "text-gray-400"}`}>
            本日お店に並んでいる商品からご注文いただけます。
          </p>
          {sameDayOk && sameDayStatus.acceptStart && sameDayStatus.acceptEnd && (
            <p className="text-xs mt-1.5 font-bold text-amber-500">
              {sameDayStatus.acceptStart}〜{sameDayStatus.acceptEnd}の間で受付しています。
            </p>
          )}
          {!sameDayOk && (
            <div className="mt-2 bg-amber-50 rounded-lg px-3 py-2">
              {sameDayStatus.reason === "closed_today" ? (
                <p className="text-xs text-gray-700">本日は定休日のため受け付けていません。</p>
              ) : (
                <p className="text-xs text-gray-700">ただいま当日注文は受け付けていません。</p>
              )}
              {sameDayStatus.acceptStart && sameDayStatus.acceptEnd && (
                <p className="text-xs text-gray-700 mt-0.5">
                  <span className="font-bold text-amber-500">
                    {sameDayStatus.acceptStart}〜{sameDayStatus.acceptEnd}
                  </span>
                  の間で受付しています。
                </p>
              )}
            </div>
          )}
        </button>

        {/* 予約注文 */}
        <button
          onClick={handleReservation}
          className="w-full border border-gray-200 rounded-xl p-4 text-left hover:shadow-md transition-shadow bg-white active:bg-gray-50"
        >
          <div className="flex items-center gap-3 mb-1.5">
            <div className="w-8 h-8 rounded-full bg-red-100 flex items-center justify-center shrink-0">
              <CalendarDays className="w-4 h-4 text-red-400" />
            </div>
            <span className="text-sm font-bold text-gray-900">予約注文</span>
          </div>
          <p className="text-xs text-gray-500 leading-relaxed">24時間ご予約を受付しています。</p>
          <p className="text-xs text-gray-500 leading-relaxed">
            本日から2営業日後以降からご予約いただけます。
          </p>
          <div className="mt-2 bg-red-50 rounded-lg px-3 py-2">
            <p className="text-xs text-red-400 font-bold">ホールケーキなどのご注文はこちら</p>
          </div>
        </button>
      </div>
    </div>
  );
}
