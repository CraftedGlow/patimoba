"use client";

import { useEffect, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Clock, CalendarDays, X } from "lucide-react";
import type { Store } from "@/lib/types";

interface OrderTypeModalProps {
  open: boolean;
  store: Store | null;
  onClose: () => void;
  onSelectSameDay: () => void;
  onSelectReservation: () => void;
}

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
      const todayDow = now.getDay(); // 0=Sun
      const yesterday = new Date(now);
      yesterday.setDate(yesterday.getDate() - 1);
      const yesterdayKey = fmtKey(yesterday);
      const yesterdayDow = yesterday.getDay();

      // store_business_hours から曜日別営業時間を取得
      const { data: hours } = await supabase
        .from("store_business_hours")
        .select("day_of_week, is_closed, open_time, close_time")
        .eq("store_id", store.id);

      const hoursMap = new Map<number, { is_closed: boolean; open_time: string | null; close_time: string | null }>();
      (hours || []).forEach((h: any) => hoursMap.set(h.day_of_week, h));

      // store_order_rules からカットオフ時間を取得
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
        defaultOpen && defaultClose &&
        toMin(defaultOpen) > toMin(defaultClose);

      // 深夜帯（open > close → 日またぎ営業）の場合、前日の営業が継続中かを先にチェック
      if (isOvernightStore && now.getHours() < 12) {
        // store_special_dates で前日の特例を確認
        const { data: yesterdaySpecial } = await supabase
          .from("store_special_dates")
          .select("is_closed, open_time, close_time")
          .eq("store_id", store.id)
          .eq("target_date", yesterdayKey)
          .maybeSingle();

        if (yesterdaySpecial) {
          if (!yesterdaySpecial.is_closed) {
            const ot = yesterdaySpecial.open_time || defaultOpen;
            const ct = yesterdaySpecial.close_time || defaultClose;
            checkTimeWindow(cutoffMinutes, ot, ct, now, setStatus);
            return;
          }
        } else {
          const yHours = hoursMap.get(yesterdayDow);
          if (!yHours?.is_closed) {
            const yOpen = yHours?.open_time ?? defaultOpen;
            const yClose = yHours?.close_time ?? defaultClose;
            checkTimeWindow(cutoffMinutes, yOpen, yClose, now, setStatus);
            return;
          }
        }
      }

      // store_special_dates で今日の特例を確認
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
        const openTime = todaySpecial.open_time || defaultOpen;
        const closeTime = todaySpecial.close_time || defaultClose;
        checkTimeWindow(cutoffMinutes, openTime, closeTime, now, setStatus);
        return;
      }

      // 曜日別定休日チェック
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

  // 日付をまたぐ営業（例: 23:00～04:30）の場合、closeを翌日として扱う
  if (closeMinutes <= openMinutes) {
    closeMinutes += 1440;
  }

  const acceptEndMinutes = closeMinutes - cutoffMin;
  let nowMinutes = now.getHours() * 60 + now.getMinutes();

  // 現在時刻がopen前の早朝（日またぎの後半）なら+1440で比較
  if (nowMinutes < openMinutes && nowMinutes < closeMinutes - 1440 + 1440) {
    if (openMinutes > 720 && nowMinutes < 720) {
      nowMinutes += 1440;
    }
  }

  const acceptEndStr = minutesToTimeStr(acceptEndMinutes);
  const acceptStartStr = formatTime(openTime);

  if (nowMinutes >= openMinutes && nowMinutes <= acceptEndMinutes) {
    setStatus({
      available: true,
      reason: "ok",
      acceptStart: acceptStartStr,
      acceptEnd: acceptEndStr,
    });
  } else {
    setStatus({
      available: false,
      reason: "outside_hours",
      acceptStart: acceptStartStr,
      acceptEnd: acceptEndStr,
    });
  }
}

export function OrderTypeModal({
  open,
  store,
  onClose,
  onSelectSameDay,
  onSelectReservation,
}: OrderTypeModalProps) {
  const sameDayStatus = useSameDayAvailability(open ? store : null);
  const sameDayOk = sameDayStatus.available;

  return (
    <AnimatePresence>
      {open && store && (
        <>
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 0.5 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black z-[60]"
            onClick={onClose}
          />
          <motion.div
            initial={{ opacity: 0, y: 80, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 80, scale: 0.95 }}
            transition={{ type: "spring", damping: 28, stiffness: 300 }}
            className="fixed inset-x-3 top-[6%] bg-white rounded-2xl shadow-2xl z-[70] max-h-[88vh] overflow-y-auto"
          >
            <div className="px-5 pt-7 pb-6 relative">
              <button
                onClick={onClose}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-gray-100 flex items-center justify-center hover:bg-gray-200 transition-colors"
              >
                <X className="w-4 h-4 text-gray-500" />
              </button>

              <h2 className="text-lg font-bold text-gray-900 text-center leading-snug">
                ご注文方法を選択してください
              </h2>
              <p className="text-xs text-gray-400 text-center mt-1.5">
                シーンに合わせてお選びいただけます
              </p>

              <div className="flex items-center justify-center gap-3 mt-5 mb-6">
                <div className="w-10 h-10 rounded-lg bg-gray-50 border border-gray-100 overflow-hidden flex items-center justify-center flex-shrink-0">
                  {store.logoUrl || store.image ? (
                    <img
                      src={store.logoUrl || store.image}
                      alt={store.name}
                      className="w-full h-full object-contain p-0.5"
                    />
                  ) : (
                    <span className="text-[8px] text-gray-400 font-medium leading-tight text-center">
                      {store.name.slice(0, 4)}
                    </span>
                  )}
                </div>
                <span className="font-bold text-base text-gray-900">{store.name}</span>
              </div>

              <button
                onClick={sameDayOk ? onSelectSameDay : undefined}
                disabled={!sameDayOk}
                className={`w-full border rounded-xl p-5 mb-3 text-left transition-shadow relative overflow-hidden ${
                  sameDayOk
                    ? "border-gray-200 hover:shadow-md bg-white"
                    : "border-gray-200 bg-white cursor-default"
                }`}
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className={`w-9 h-9 rounded-full flex items-center justify-center shrink-0 ${sameDayOk ? "bg-amber-50" : "bg-gray-100"}`}>
                    <Clock className={`w-[18px] h-[18px] ${sameDayOk ? "text-amber-500" : "text-gray-400"}`} />
                  </div>
                  <span className={`text-base font-bold ${sameDayOk ? "text-gray-900" : "text-gray-400"}`}>
                    当日受取注文
                  </span>
                </div>
                <p className={`text-sm ml-12 leading-relaxed ${sameDayOk ? "text-gray-600" : "text-gray-400"}`}>
                  本日お店に並んでいる商品からご注文いただけます。
                </p>
                {!sameDayOk && (
                  <div className="mt-3 ml-12 bg-[#FFF9C4] rounded-lg px-4 py-3">
                    {sameDayStatus.reason === "closed_today" ? (
                      <p className="text-sm text-gray-800 leading-relaxed">
                        本日は定休日のため、当日注文は受け付けていません。
                      </p>
                    ) : (
                      <p className="text-sm text-gray-800 leading-relaxed">
                        ただいま当日注文は受け付けていません。
                      </p>
                    )}
                    {sameDayStatus.acceptStart && sameDayStatus.acceptEnd && (
                      <p className="text-sm text-gray-800 leading-relaxed">
                        営業日の
                        <span className="font-bold text-red-500">
                          {sameDayStatus.acceptStart}~{sameDayStatus.acceptEnd}
                        </span>
                        の間で受付しています。
                      </p>
                    )}
                  </div>
                )}
              </button>

              <button
                onClick={onSelectReservation}
                className="w-full border border-gray-200 rounded-xl p-5 text-left hover:shadow-md transition-shadow bg-white"
              >
                <div className="flex items-center gap-3 mb-2">
                  <div className="w-9 h-9 rounded-full bg-orange-50 flex items-center justify-center shrink-0">
                    <CalendarDays className="w-[18px] h-[18px] text-orange-500" />
                  </div>
                  <span className="text-base font-bold text-gray-900">予約注文</span>
                </div>
                <p className="text-sm text-gray-600 ml-12 leading-relaxed">
                  24時間ご予約を受付しています。
                </p>
                <p className="text-sm text-gray-600 ml-12 leading-relaxed">
                  本日から2営業日後以降からご予約いただけます。
                </p>

                <div className="mt-3 ml-12 bg-red-50 rounded-lg px-4 py-2.5">
                  <p className="text-sm text-red-500 font-bold">
                    ホールケーキなどのご注文はこちら
                  </p>
                </div>
              </button>
            </div>
          </motion.div>
        </>
      )}
    </AnimatePresence>
  );
}
