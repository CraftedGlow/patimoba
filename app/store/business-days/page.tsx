"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toJpeg } from "html-to-image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X, Loader2 } from "lucide-react";
import { MonthView } from "@/components/store/business-days/month-view";
import { WeekView } from "@/components/store/business-days/week-view";
import { DayView } from "@/components/store/business-days/day-view";
import type { DaySchedule, ViewMode, ClosedDayRule } from "@/components/store/business-days/types";
import {
  getWeekStartDate,
  formatDateKey,
  timeOptions,
} from "@/components/store/business-days/types";
import { useStoreContext } from "@/lib/store-context";
import { useBusinessDays } from "@/hooks/use-business-days";
import { supabase } from "@/lib/supabase";

export default function BusinessDaysPage() {
  const { storeId } = useStoreContext();
  const { businessDays, loading, saveMonth, addBusinessDay, updateBusinessDay, deleteBusinessDay, refetch } = useBusinessDays(storeId);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [schedules, setSchedules] = useState<Record<string, DaySchedule>>({});
  const [showNextMonthAlert, setShowNextMonthAlert] = useState(true);
  const [showSubmitConfirm, setShowSubmitConfirm] = useState(false);
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editDate, setEditDate] = useState<string>("");
  const [editOpen, setEditOpen] = useState("");
  const [editClose, setEditClose] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const calendarRef = useRef<HTMLDivElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const onClick = (e: MouseEvent) => {
      if (exportMenuRef.current && !exportMenuRef.current.contains(e.target as Node)) {
        setShowExportMenu(false);
      }
    };
    document.addEventListener("mousedown", onClick);
    return () => document.removeEventListener("mousedown", onClick);
  }, []);

  const handleExportImage = async (mode: "post" | "story") => {
    if (!calendarRef.current) return;
    setExporting(true);
    setShowExportMenu(false);
    try {
      const width = mode === "post" ? 1080 : 1080;
      const height = mode === "post" ? 1080 : 1920;
      const node = calendarRef.current;
      const scale = Math.min(width / node.offsetWidth, height / node.offsetHeight);
      const dataUrl = await toJpeg(node, {
        quality: 0.95,
        backgroundColor: "#ffffff",
        canvasWidth: width,
        canvasHeight: height,
        pixelRatio: 2,
        style: {
          transform: `scale(${scale})`,
          transformOrigin: "top left",
          width: `${node.offsetWidth}px`,
          height: `${node.offsetHeight}px`,
        },
      });
      const link = document.createElement("a");
      link.download = `business-days-${year}-${month + 1}-${mode}.jpg`;
      link.href = dataUrl;
      link.click();
    } catch (e) {
      console.error(e);
    }
    setExporting(false);
  };

  const [storeOpenTime, setStoreOpenTime] = useState("10:00");
  const [storeCloseTime, setStoreCloseTime] = useState("19:00");
  const [closedDayRules, setClosedDayRules] = useState<ClosedDayRule[]>([]);

  const [weekStart, setWeekStart] = useState(() => {
    const d = new Date(today);
    d.setDate(d.getDate() - d.getDay());
    return d;
  });

  const weekdayNames = ["日曜日", "月曜日", "火曜日", "水曜日", "木曜日", "金曜日", "土曜日"];

  useEffect(() => {
    if (!storeId) return;
    let cancelled = false;

    (async () => {
      // store_business_hours から営業時間と定休日を取得
      const { data: bhData } = await supabase
        .from("store_business_hours")
        .select("day_of_week, open_time, close_time, is_closed")
        .eq("store_id", storeId)
        .order("day_of_week", { ascending: true });
      if (cancelled) return;
      if (bhData && bhData.length > 0) {
        // 営業日の最初のレコードからopen/close timeを取得
        const openDay = bhData.find((r: any) => !r.is_closed);
        if (openDay) {
          setStoreOpenTime(openDay.open_time || "10:00");
          setStoreCloseTime(openDay.close_time || "19:00");
        }
        // 定休日を抽出
        const closed = bhData.filter((r: any) => r.is_closed);
        if (closed.length > 0) {
          setClosedDayRules(
            closed.map((r: any) => ({
              dayOfWeek: r.day_of_week,
              day: weekdayNames[r.day_of_week] ?? `${r.day_of_week}`,
              rule: "毎週",
            }))
          );
        } else {
          setClosedDayRules([]);
        }
      } else {
        setClosedDayRules([]);
      }
    })();

    return () => { cancelled = true; };
  }, [storeId]);

  // DB → ローカルschedules同期
  useEffect(() => {
    const map: Record<string, DaySchedule> = {};
    for (const bd of businessDays) {
      map[bd.date] = {
        isOpen: bd.isOpen,
        openTime: bd.openTime || storeOpenTime,
        closeTime: bd.closeTime || storeCloseTime,
      };
    }
    setSchedules(map);
  }, [businessDays, storeOpenTime, storeCloseTime]);

  const nextMonthLabel = `${month + 2 > 12 ? 1 : month + 2}月`;

  const prevNav = () => {
    if (viewMode === "month") {
      if (month === 0) { setYear(year - 1); setMonth(11); } else { setMonth(month - 1); }
    } else if (viewMode === "week") {
      const d = new Date(weekStart);
      d.setDate(d.getDate() - 7);
      setWeekStart(d);
    } else {
      const d = new Date(year, month, selectedDay - 1);
      setYear(d.getFullYear()); setMonth(d.getMonth()); setSelectedDay(d.getDate());
    }
  };

  const nextNav = () => {
    if (viewMode === "month") {
      if (month === 11) { setYear(year + 1); setMonth(0); } else { setMonth(month + 1); }
    } else if (viewMode === "week") {
      const d = new Date(weekStart);
      d.setDate(d.getDate() + 7);
      setWeekStart(d);
    } else {
      const d = new Date(year, month, selectedDay + 1);
      setYear(d.getFullYear()); setMonth(d.getMonth()); setSelectedDay(d.getDate());
    }
  };

  const goToToday = () => {
    const t = new Date();
    setYear(t.getFullYear()); setMonth(t.getMonth()); setSelectedDay(t.getDate());
    setWeekStart(getWeekStartDate(t));
  };

  const handleDayClick = useCallback((y: number, m: number, d: number) => {
    const dateKey = formatDateKey(y, m, d);
    setEditDate(dateKey);
    setEditOpen(schedules[dateKey]?.openTime || storeOpenTime);
    setEditClose(schedules[dateKey]?.closeTime || storeCloseTime);
    setShowEditPanel(true);
    setYear(y); setMonth(m); setSelectedDay(d);
  }, [schedules, storeOpenTime, storeCloseTime]);

  const handleUpdateSchedule = useCallback(
    (key: string, schedule: DaySchedule) => {
      setSchedules((prev) => ({ ...prev, [key]: schedule }));
    }, []
  );

  const handleSaveTimeChange = async () => {
    if (!storeId || !editDate) return;
    setSaving(true);
    try {
      const existing = businessDays.find((bd) => bd.date === editDate);
      if (existing) {
        await updateBusinessDay(existing.id, { openTime: editOpen, closeTime: editClose, isOpen: true });
      } else {
        await addBusinessDay({ date: editDate, openTime: editOpen, closeTime: editClose, isOpen: true, storeId });
      }
      setShowEditPanel(false);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const handleSetClosed = async () => {
    if (!storeId || !editDate) return;
    setSaving(true);
    try {
      const existing = businessDays.find((bd) => bd.date === editDate);
      if (existing) {
        await updateBusinessDay(existing.id, { isOpen: false });
      } else {
        await addBusinessDay({ date: editDate, openTime: "", closeTime: "", isOpen: false, storeId });
      }
      setShowEditPanel(false);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const handleSubmit = async () => {
    if (!storeId) return;
    setSaving(true);
    try {
      const daysInMonth = new Date(year, month + 1, 0).getDate();
      const entries: Array<{ date: string; isClosed: boolean; openTime: string | null; closeTime: string | null }> = [];
      for (let d = 1; d <= daysInMonth; d++) {
        const key = formatDateKey(year, month, d);
        const s = schedules[key];
        if (s) {
          entries.push({ date: key, isClosed: !s.isOpen, openTime: s.openTime, closeTime: s.closeTime });
        }
      }
      await saveMonth(storeId, year, month, entries);
      setShowSubmitConfirm(true);
      setTimeout(() => setShowSubmitConfirm(false), 2000);
    } catch (e) {
      console.error(e);
    }
    setSaving(false);
  };

  const getTitle = () => {
    if (viewMode === "month") return `${year}年${month + 1}月`;
    if (viewMode === "week") {
      const end = new Date(weekStart);
      end.setDate(end.getDate() + 6);
      return `${weekStart.getFullYear()}年${weekStart.getMonth() + 1}月${weekStart.getDate()}日 – ${end.getMonth() + 1}月${end.getDate()}日`;
    }
    return `${year}年${month + 1}月${selectedDay}日`;
  };

  const editDateFormatted = editDate
    ? (() => {
        const [y, m, d] = editDate.split("-").map(Number);
        return `${y}年${m}月${d}日`;
      })()
    : "";

  if (loading) {
    return (
      <div className="p-6 flex items-center justify-center h-64">
        <Loader2 className="w-7 h-7 text-amber-400 animate-spin" />
      </div>
    );
  }

  return (
    <div className="p-6 relative flex gap-6">
      <div className="flex-1">
        <div className="flex items-start gap-8 mb-6">
          <div>
            <div className="flex items-center gap-8 mb-1">
              <div>
                <span className="text-xs text-gray-500 block">OPEN</span>
                <span className="text-3xl font-bold">{storeOpenTime}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">CLOSE</span>
                <span className="text-3xl font-bold">{storeCloseTime}</span>
              </div>
            </div>
            <div className="mt-1">
              <span className="text-sm text-gray-500">定休日</span>
              <div className="flex items-center gap-6 mt-0.5">
                {closedDayRules.length > 0 ? (
                  closedDayRules.map((r, i) => (
                    <span key={i} className="text-sm font-medium">
                      {r.day} <span className="text-gray-500">{r.rule}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-sm text-gray-400">未設定</span>
                )}
              </div>
            </div>
          </div>
          <motion.button
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={handleSubmit}
            disabled={saving}
            className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 py-3 rounded-xl transition-colors text-sm mt-1 disabled:opacity-50 flex items-center gap-2"
          >
            {saving && <Loader2 className="w-4 h-4 animate-spin" />}
            {month + 1}月の営業日を提出
          </motion.button>

          <div ref={exportMenuRef} className="relative mt-1">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowExportMenu((v) => !v)}
              disabled={exporting}
              className="border border-amber-500 text-amber-600 hover:bg-amber-50 font-bold px-4 py-3 rounded-xl transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {exporting && <Loader2 className="w-4 h-4 animate-spin" />}
              Instagram用画像
            </motion.button>
            <AnimatePresence>
              {showExportMenu && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-[200px] overflow-hidden"
                >
                  <button
                    onClick={() => handleExportImage("post")}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors"
                  >
                    投稿サイズ (1080×1080)
                  </button>
                  <button
                    onClick={() => handleExportImage("story")}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors border-t border-gray-100"
                  >
                    ストーリーズ (1080×1920)
                  </button>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>

        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <button onClick={goToToday} className="border border-gray-400 text-gray-700 text-sm font-medium px-3 py-1.5 rounded-lg hover:bg-gray-100 transition-colors">
              今日
            </button>
            <div className="flex items-center border border-gray-400 rounded-lg overflow-hidden">
              <button onClick={prevNav} className="px-2 py-1.5 hover:bg-gray-100 transition-colors border-r border-gray-400">
                <ChevronLeft className="w-4 h-4" />
              </button>
              <button onClick={nextNav} className="px-2 py-1.5 hover:bg-gray-100 transition-colors">
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          </div>
          <h2 className="text-lg font-bold">{getTitle()}</h2>
          <div className="flex items-center border border-gray-400 rounded-lg overflow-hidden">
            {(["month", "week", "day"] as ViewMode[]).map((mode) => (
              <button
                key={mode}
                onClick={() => {
                  setViewMode(mode);
                  if (mode === "week") setWeekStart(getWeekStartDate(new Date(year, month, selectedDay)));
                }}
                className={`px-3 py-1.5 text-sm font-medium transition-colors ${
                  viewMode === mode ? "bg-gray-700 text-white" : "text-gray-600 hover:bg-gray-100"
                } ${mode !== "day" ? "border-r border-gray-400" : ""}`}
              >
                {mode === "month" ? "月" : mode === "week" ? "週" : "日"}
              </button>
            ))}
          </div>
        </div>

        <div ref={calendarRef} className="bg-white p-4 rounded-lg">
          <div className="text-center mb-3">
            <h3 className="text-2xl font-bold">{year}年 {month + 1}月 営業日カレンダー</h3>
            <div className="text-sm text-gray-600 mt-1">
              OPEN {storeOpenTime} / CLOSE {storeCloseTime}
            </div>
          </div>
        {viewMode === "month" && (
          <MonthView year={year} month={month} schedules={schedules} onDayClick={handleDayClick} defaultOpenTime={storeOpenTime} closedDayRules={closedDayRules} />
        )}
        {viewMode === "week" && (
          <WeekView weekStart={weekStart} schedules={schedules} onDayClick={handleDayClick} defaultOpenTime={storeOpenTime} defaultCloseTime={storeCloseTime} closedDayRules={closedDayRules} />
        )}
        {viewMode === "day" && (
          <DayView year={year} month={month} day={selectedDay} schedules={schedules} onUpdateSchedule={handleUpdateSchedule} defaultOpenTime={storeOpenTime} defaultCloseTime={storeCloseTime} closedDayRules={closedDayRules} />
        )}
        </div>
      </div>

      {/* 右側編集パネル */}
      <AnimatePresence>
        {showEditPanel && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-[280px] shrink-0"
          >
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-lg relative">
              <button
                onClick={() => setShowEditPanel(false)}
                className="absolute top-3 right-3 text-gray-400 hover:text-gray-600"
              >
                <X className="w-5 h-5" />
              </button>
              <h3 className="text-base font-bold text-center mb-1">営業時間の変更</h3>
              <p className="text-sm font-bold text-center mb-4">{editDateFormatted}</p>

              <div className="space-y-3 mb-5">
                <div>
                  <label className="text-sm font-medium block mb-1">OPEN</label>
                  <select
                    value={editOpen}
                    onChange={(e) => setEditOpen(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">開店時刻</option>
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="text-sm font-medium block mb-1">CLOSE</label>
                  <select
                    value={editClose}
                    onChange={(e) => setEditClose(e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white"
                  >
                    <option value="">閉店時刻</option>
                    {timeOptions.map((t) => (
                      <option key={t} value={t}>{t}</option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="space-y-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSaveTimeChange}
                  disabled={saving}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50"
                >
                  {viewMode === "month" ? "営業日に変更" : "上記の時間に変更"}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={handleSetClosed}
                  disabled={saving}
                  className="w-full bg-amber-400 hover:bg-amber-500 text-white font-bold py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50"
                >
                  休みに変更
                </motion.button>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 初回モーダル */}
      <AnimatePresence>
        {showNextMonthAlert && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
            onClick={() => setShowNextMonthAlert(false)}
          >
            <motion.div
              initial={{ y: 10 }}
              animate={{ y: 0 }}
              className="bg-white rounded-xl px-12 py-8 shadow-xl"
              onClick={(e) => e.stopPropagation()}
            >
              <p className="text-lg font-bold text-center">来月の営業日を確認してください!</p>
              <div className="flex justify-center mt-4">
                <button
                  onClick={() => setShowNextMonthAlert(false)}
                  className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-6 py-2 rounded-lg transition-colors text-sm"
                >
                  OK
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* 提出確認 */}
      <AnimatePresence>
        {showSubmitConfirm && (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed inset-0 bg-black/30 flex items-center justify-center z-50"
            onClick={() => setShowSubmitConfirm(false)}
          >
            <motion.div initial={{ y: 10 }} animate={{ y: 0 }} className="bg-white rounded-xl px-12 py-8 shadow-xl" onClick={(e) => e.stopPropagation()}>
              <p className="text-lg font-bold text-center">{month + 1}月の予定を提出しました</p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
