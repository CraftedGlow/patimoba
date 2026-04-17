"use client";

import { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { useRouter, useSearchParams } from "next/navigation";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { useCustomerContext } from "@/lib/customer-context";
import { useCart } from "@/lib/cart-context";
import { supabase } from "@/lib/supabase";

const steps = ["店舗選択", "商品選択", "受取日時", "注文確認"];
const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

function toMin(time: string): number {
  const [h, m] = time.split(":").map(Number);
  return h * 60 + (m || 0);
}

function minutesToTimeStr(m: number): string {
  const h = Math.floor(m / 60) % 24;
  const min = m % 60;
  return `${String(h).padStart(2, "0")}:${String(min).padStart(2, "0")}`;
}

function generateTimeSlots(startMin: number, endMin: number, intervalMin = 30): string[] {
  const slots: string[] = [];
  let cur = Math.ceil(startMin / intervalMin) * intervalMin;
  while (cur <= endMin) {
    slots.push(minutesToTimeStr(cur));
    cur += intervalMin;
  }
  return slots;
}

interface StoreRules {
  prepMinutes: number;       // 準備時間（分）
  cutoffMinutes: number;     // CLOSE前受付終了（分）
  minFutureDays: number;     // 予約最低事前日数
}

interface BusinessHour {
  dayOfWeek: number;
  isClosed: boolean;
  openTime: string | null;
  closeTime: string | null;
}

export default function TakeoutPickupPage() {
  const router = useRouter();
  const searchParams = useSearchParams();
  const orderType = searchParams.get("type") ?? "reservation";
  const storeParam = searchParams.get("store") ?? "";
  const isSameDay = orderType === "sameday";

  const { selectedStoreName, selectedStoreId } = useCustomerContext();
  const { items: cartItems, storeId: cartStoreId } = useCart();
  const storeId = selectedStoreId || cartStoreId || storeParam || null;

  const [selectedDate, setSelectedDate] = useState<Date | null>(isSameDay ? new Date() : null);
  const [selectedTime, setSelectedTime] = useState<string>("");
  const [loading, setLoading] = useState(true);

  // 店舗設定
  const [storeRules, setStoreRules] = useState<StoreRules>({
    prepMinutes: 90,
    cutoffMinutes: 180,
    minFutureDays: 2,
  });
  const [businessHours, setBusinessHours] = useState<BusinessHour[]>([]);

  // 商品制約
  const [maxPreparationDays, setMaxPreparationDays] = useState(2);
  const [earliestLimitedUntil, setEarliestLimitedUntil] = useState<Date | null>(null);

  // カレンダー表示月
  const today = new Date();
  const [currentMonth, setCurrentMonth] = useState(today.getMonth());
  const [currentYear, setCurrentYear] = useState(today.getFullYear());

  useEffect(() => {
    if (!storeId) {
      setLoading(false);
      return;
    }

    const fetchData = async () => {
      setLoading(true);
      try {
        // 店舗設定取得
        const { data: rules } = await supabase
          .from("store_order_rules")
          .select("default_cutoff_time, default_lead_time_minutes, min_future_days")
          .eq("store_id", storeId)
          .maybeSingle();

        const prepMin = rules?.default_cutoff_time
          ? Number(rules.default_cutoff_time)
          : 90;
        const cutoffMin = rules?.default_lead_time_minutes ?? 180;
        const minFuture = rules?.min_future_days ?? 2;

        setStoreRules({
          prepMinutes: isNaN(prepMin) ? 90 : prepMin,
          cutoffMinutes: cutoffMin,
          minFutureDays: minFuture,
        });

        // 営業時間取得
        const { data: bhRows } = await supabase
          .from("store_business_hours")
          .select("day_of_week, is_closed, open_time, close_time")
          .eq("store_id", storeId);

        setBusinessHours(
          (bhRows || []).map((r: any) => ({
            dayOfWeek: r.day_of_week,
            isClosed: r.is_closed,
            openTime: r.open_time,
            closeTime: r.close_time,
          }))
        );

        // カート内商品のpreparation_daysとlimited_untilを取得
        const productIds = cartItems.map((i) => i.productId).filter(Boolean);
        if (productIds.length > 0) {
          const { data: productRows } = await supabase
            .from("products")
            .select("id, preparation_days, limited_until")
            .in("id", productIds);

          if (productRows && productRows.length > 0) {
            const maxDays = Math.max(
              ...productRows.map((p: any) => Number(p.preparation_days) || 0)
            );
            setMaxPreparationDays(Math.max(maxDays, minFuture));

            const limitedDates = productRows
              .filter((p: any) => p.limited_until)
              .map((p: any) => new Date(p.limited_until));
            if (limitedDates.length > 0) {
              setEarliestLimitedUntil(
                limitedDates.reduce((a, b) => (a < b ? a : b))
              );
            }
          }
        }
      } finally {
        setLoading(false);
      }
    };

    fetchData();
  }, [storeId, cartItems]);

  // 当日注文の時間スロット生成
  const sameDayTimeSlots = (() => {
    if (!isSameDay || businessHours.length === 0) return [];
    const todayDow = new Date().getDay();
    const todayHours = businessHours.find((b) => b.dayOfWeek === todayDow && !b.isClosed);
    if (!todayHours?.openTime || !todayHours?.closeTime) return [];

    const now = new Date();
    const nowMin = now.getHours() * 60 + now.getMinutes();
    const startMin = nowMin + storeRules.prepMinutes;
    const closeMin = toMin(todayHours.closeTime);
    const endMin = closeMin - storeRules.cutoffMinutes;

    return generateTimeSlots(startMin, endMin);
  })();

  // 予約注文の時間スロット（日付選択後）
  const reservationTimeSlots = (() => {
    if (isSameDay || !selectedDate) return [];
    const dow = selectedDate.getDay();
    const bh = businessHours.find((b) => b.dayOfWeek === dow && !b.isClosed);
    if (!bh?.openTime || !bh?.closeTime) return [];
    return generateTimeSlots(toMin(bh.openTime), toMin(bh.closeTime));
  })();

  const timeSlots = isSameDay ? sameDayTimeSlots : reservationTimeSlots;

  // 初期時間設定
  useEffect(() => {
    if (timeSlots.length > 0 && !selectedTime) {
      setSelectedTime(timeSlots[0]);
    }
  }, [timeSlots, selectedTime]);

  // カレンダー
  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const startDay = firstDayOfMonth.getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  const isDateSelectable = (day: number): boolean => {
    const date = new Date(currentYear, currentMonth, day);
    date.setHours(0, 0, 0, 0);

    // 最低事前日数チェック
    const minDate = new Date(today);
    minDate.setDate(today.getDate() + maxPreparationDays);
    minDate.setHours(0, 0, 0, 0);
    if (date < minDate) return false;

    // 期間限定商品の上限日チェック
    if (earliestLimitedUntil) {
      const limitDate = new Date(earliestLimitedUntil);
      limitDate.setHours(23, 59, 59, 999);
      if (date > limitDate) return false;
    }

    // 営業日チェック
    const dow = date.getDay();
    const bh = businessHours.find((b) => b.dayOfWeek === dow);
    if (bh?.isClosed) return false;

    return true;
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === currentMonth &&
      selectedDate.getFullYear() === currentYear
    );
  };

  const canProceed = isSameDay
    ? selectedTime.length > 0
    : selectedDate !== null && selectedTime.length > 0;

  const handleProceed = () => {
    // 選択した日時をsessionStorageに保存してconfirmページへ
    const dateStr = isSameDay
      ? today.toISOString().split("T")[0]
      : selectedDate?.toISOString().split("T")[0] ?? "";
    sessionStorage.setItem("patimoba_pickup_date", dateStr);
    sessionStorage.setItem("patimoba_pickup_time", selectedTime);
    sessionStorage.setItem("patimoba_order_type", orderType);
    router.push("/customer/takeout/confirm");
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-white flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-amber-400 border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader shopName={selectedStoreName || "パティモバ"} />

      <StepProgress currentStep={3} steps={steps} />

      <div className="px-4 md:px-8 lg:px-12 pb-8 md:max-w-2xl md:mx-auto">
        <h2 className="text-lg font-bold mb-4">受け取り日時を選択</h2>

        {/* 予約注文：カレンダー表示 */}
        {!isSameDay && (
          <div className="border border-gray-200 rounded-xl p-4 md:p-6 mb-4">
            <div className="flex items-center justify-between mb-3">
              <button
                onClick={() => {
                  if (currentMonth === 0) {
                    setCurrentMonth(11);
                    setCurrentYear((y) => y - 1);
                  } else {
                    setCurrentMonth((m) => m - 1);
                  }
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                ‹
              </button>
              <div className="text-center text-sm font-bold">
                {currentYear}年{currentMonth + 1}月
              </div>
              <button
                onClick={() => {
                  if (currentMonth === 11) {
                    setCurrentMonth(0);
                    setCurrentYear((y) => y + 1);
                  } else {
                    setCurrentMonth((m) => m + 1);
                  }
                }}
                className="p-1 text-gray-400 hover:text-gray-600"
              >
                ›
              </button>
            </div>

            <div className="grid grid-cols-7 gap-0 text-center">
              {weekdays.map((wd) => (
                <div key={wd} className="text-xs font-medium text-gray-400 py-1.5">
                  {wd}
                </div>
              ))}
              {calendarCells.map((day, i) => {
                if (day === null) return <div key={`empty-${i}`} />;
                const selectable = isDateSelectable(day);
                const selected = isSelected(day);
                return (
                  <motion.button
                    key={day}
                    whileTap={selectable ? { scale: 0.9 } : undefined}
                    disabled={!selectable}
                    onClick={() => {
                      setSelectedDate(new Date(currentYear, currentMonth, day));
                      setSelectedTime(""); // 日付変更時に時間をリセット
                    }}
                    className={`aspect-square flex items-center justify-center text-sm rounded-lg m-0.5 transition-colors ${
                      selected
                        ? "border-2 border-amber-400 bg-amber-50 text-amber-700 font-bold"
                        : selectable
                        ? "text-gray-900 hover:bg-amber-50 border border-gray-200"
                        : "text-gray-300 border border-transparent"
                    }`}
                  >
                    {day}
                  </motion.button>
                );
              })}
            </div>

            {earliestLimitedUntil && (
              <p className="text-xs text-red-500 mt-3 text-center">
                期間限定商品が含まれています。{earliestLimitedUntil.toLocaleDateString("ja-JP")}まで受け取り可能です。
              </p>
            )}
          </div>
        )}

        {/* 当日注文：今日の日付表示 */}
        {isSameDay && (
          <div className="border border-amber-200 bg-amber-50 rounded-xl p-4 mb-4">
            <p className="text-sm font-bold text-amber-700">
              本日 {today.getFullYear()}年{today.getMonth() + 1}月{today.getDate()}日（{weekdays[today.getDay()]}）
            </p>
            <p className="text-xs text-amber-600 mt-1">当日注文は今日のみ受け取り可能です</p>
          </div>
        )}

        {/* 時間選択 */}
        <div className="mb-6">
          <label className="block text-sm font-bold mb-2">時刻を選択</label>
          {timeSlots.length === 0 ? (
            <p className="text-sm text-gray-400">
              {isSameDay
                ? "現在、当日注文の受付時間外です"
                : selectedDate
                ? "この日は営業していません"
                : "日付を選択してください"}
            </p>
          ) : (
            <select
              value={selectedTime}
              onChange={(e) => setSelectedTime(e.target.value)}
              className="w-full md:max-w-xs border border-gray-300 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent appearance-none"
              style={{
                backgroundImage:
                  "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%239ca3af' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\")",
                backgroundRepeat: "no-repeat",
                backgroundPosition: "right 12px center",
              }}
            >
              {timeSlots.map((t) => (
                <option key={t} value={t}>
                  {t}
                </option>
              ))}
            </select>
          )}
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={handleProceed}
          disabled={!canProceed}
          className="w-full md:max-w-md md:mx-auto md:block bg-amber-400 hover:bg-amber-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-full text-base transition-colors"
        >
          注文内容の確認へ
        </motion.button>
      </div>
    </div>
  );
}
