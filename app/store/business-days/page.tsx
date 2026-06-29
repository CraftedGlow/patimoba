"use client";

import { useState, useCallback, useEffect, useRef } from "react";
import { toJpeg } from "html-to-image";
import { motion, AnimatePresence } from "framer-motion";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { LineSpinner } from "@/components/ui/line-spinner";
import { MonthView } from "@/components/store/business-days/month-view";
import { WeekView } from "@/components/store/business-days/week-view";
import { DayView } from "@/components/store/business-days/day-view";
import type { DaySchedule, ViewMode, ClosedDayRule } from "@/components/store/business-days/types";
import {
  getWeekStartDate,
  formatDateKey,
  timeOptions,
  formatTimeHm,
  formatTimeRange,
  isClosedByRule,
} from "@/components/store/business-days/types";
import { useStoreContext } from "@/lib/store-context";
import { useBusinessDays } from "@/hooks/use-business-days";
import { supabase } from "@/lib/supabase";

const WEEKDAYS = [
  { label: "日", value: 0 },
  { label: "月", value: 1 },
  { label: "火", value: 2 },
  { label: "水", value: 3 },
  { label: "木", value: 4 },
  { label: "金", value: 5 },
  { label: "土", value: 6 },
];

const EN_MONTHS = [
  "January","February","March","April","May","June",
  "July","August","September","October","November","December",
];

export default function BusinessDaysPage() {
  const { storeId, storeName, storeLogo } = useStoreContext();
  const { businessDays, loading, addBusinessDay, updateBusinessDay } = useBusinessDays(storeId);

  const today = new Date();
  const [year, setYear] = useState(today.getFullYear());
  const [month, setMonth] = useState(today.getMonth());
  const [selectedDay, setSelectedDay] = useState(today.getDate());
  const [viewMode, setViewMode] = useState<ViewMode>("month");
  const [schedules, setSchedules] = useState<Record<string, DaySchedule>>({});
  const [showEditPanel, setShowEditPanel] = useState(false);
  const [editDate, setEditDate] = useState<string>("");
  const [editOpen, setEditOpen] = useState("");
  const [editClose, setEditClose] = useState("");
  const [editNote, setEditNote] = useState("");
  const [saving, setSaving] = useState(false);
  const [exporting, setExporting] = useState(false);
  const [showExportMenu, setShowExportMenu] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
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

  type ExportFormat = "square" | "landscape" | "portrait" | "natural";

  /** カレンダー領域を画像化（正方形・横長・縦長・原寸のいずれか） */
  const handleExportImage = async (format: ExportFormat) => {
    if (!calendarRef.current) return;
    setExporting(true);
    setShowExportMenu(false);
    setSaveError(null);
    try {
      const node = calendarRef.current;

      // DOMレイアウト確定を待つ
      await new Promise<void>((r) => requestAnimationFrame(() => r()));
      await new Promise<void>((r) => requestAnimationFrame(() => r()));

      const nodeW = node.offsetWidth;
      const nodeH = node.offsetHeight;
      const pixelRatio = format === "natural" ? 2 : 3;

      // style オプションで幅を明示固定（html-to-image がキャプチャ時に
      // max-width 制約を失い要素が画面幅まで拡張されるバグを回避）
      const captureStyle: Partial<CSSStyleDeclaration> = {
        width: `${nodeW}px`,
        maxWidth: `${nodeW}px`,
        margin: "0",
      };

      const rawDataUrl = await toJpeg(node, {
        quality: 0.95,
        backgroundColor: "#ffffff",
        pixelRatio,
        width: nodeW,
        height: nodeH,
        style: captureStyle,
      });

      if (format === "natural") {
        const link = document.createElement("a");
        link.download = `calendar-${year}-${month + 1}-natural.jpg`;
        link.href = rawDataUrl;
        link.click();
        return;
      }

      const targets: Record<string, [number, number]> = {
        square: [1080, 1080],
        landscape: [1920, 1080],
        portrait: [1080, 1920],
      };
      const suffixes: Record<string, string> = {
        square: "1080x1080",
        landscape: "1920x1080",
        portrait: "1080x1920",
      };
      const [targetW, targetH] = targets[format];

      const img = new Image();
      img.src = rawDataUrl;
      await img.decode();

      const iw = img.naturalWidth || nodeW * pixelRatio;
      const ih = img.naturalHeight || nodeH * pixelRatio;

      const scale = Math.min(targetW / iw, targetH / ih);
      const drawW = Math.round(iw * scale);
      const drawH = Math.round(ih * scale);
      const x = Math.round((targetW - drawW) / 2);
      const y = Math.round((targetH - drawH) / 2);

      const canvas = document.createElement("canvas");
      canvas.width = targetW;
      canvas.height = targetH;
      const ctx = canvas.getContext("2d")!;
      ctx.imageSmoothingEnabled = true;
      ctx.imageSmoothingQuality = "high";
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, targetW, targetH);
      ctx.drawImage(img, x, y, drawW, drawH);

      const finalDataUrl = canvas.toDataURL("image/jpeg", 0.95);
      const link = document.createElement("a");
      link.download = `calendar-${year}-${month + 1}-${suffixes[format]}.jpg`;
      link.href = finalDataUrl;
      link.click();
    } catch (e) {
      console.error(e);
      setSaveError("画像の保存に失敗しました。もう一度お試しください。");
    } finally {
      setExporting(false);
    }
  };

  const [storeOpenTime, setStoreOpenTime] = useState("10:00");
  const [storeCloseTime, setStoreCloseTime] = useState("19:00");
  const [closedDayRules, setClosedDayRules] = useState<ClosedDayRule[]>([]);
  const [showHolidayModal, setShowHolidayModal] = useState(false);
  const [modalHolidays, setModalHolidays] = useState<{ dayOfWeek: number; rule: string }[]>([]);
  const [holidaySaving, setHolidaySaving] = useState(false);

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
        .select("day_of_week, open_time, close_time, is_closed, closed_week_rule")
        .eq("store_id", storeId)
        .order("day_of_week", { ascending: true });
      if (cancelled) return;
      if (bhData && bhData.length > 0) {
        const openDay = bhData.find((r: any) => !r.is_closed);
        if (openDay) {
          setStoreOpenTime(formatTimeHm(openDay.open_time) || "10:00");
          setStoreCloseTime(formatTimeHm(openDay.close_time) || "19:00");
        }
        const closed = bhData.filter((r: any) => r.is_closed);
        if (closed.length > 0) {
          setClosedDayRules(
            closed.map((r: any) => ({
              dayOfWeek: r.day_of_week,
              day: weekdayNames[r.day_of_week] ?? `${r.day_of_week}`,
              rule: r.closed_week_rule ?? "毎週",
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
        openTime: formatTimeHm(bd.openTime) || storeOpenTime,
        closeTime: formatTimeHm(bd.closeTime) || storeCloseTime,
        dailyNote: bd.dailyNote ?? "",
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

  const openHolidayModal = useCallback(() => {
    setModalHolidays(closedDayRules.map((r) => ({ dayOfWeek: r.dayOfWeek, rule: r.rule })));
    setShowHolidayModal(true);
  }, [closedDayRules]);

  const toggleModalHoliday = (dayOfWeek: number) => {
    setModalHolidays((prev) => {
      const exists = prev.find((h) => h.dayOfWeek === dayOfWeek);
      if (exists) return prev.filter((h) => h.dayOfWeek !== dayOfWeek);
      return [...prev, { dayOfWeek, rule: "毎週" }].sort((a, b) => a.dayOfWeek - b.dayOfWeek);
    });
  };

  const updateModalHolidayRule = (dayOfWeek: number, rule: string) => {
    setModalHolidays((prev) =>
      prev.map((h) => (h.dayOfWeek === dayOfWeek ? { ...h, rule } : h))
    );
  };

  const saveHolidayRules = async () => {
    if (!storeId) return;
    setHolidaySaving(true);
    try {
      await supabase.from("store_business_hours").delete().eq("store_id", storeId);
      const allDays = Array.from({ length: 7 }, (_, i) => {
        const isClosed = modalHolidays.some((h) => h.dayOfWeek === i);
        const closedRule = modalHolidays.find((h) => h.dayOfWeek === i)?.rule ?? null;
        return {
          store_id: storeId,
          day_of_week: i,
          is_closed: isClosed,
          open_time: isClosed ? null : storeOpenTime,
          close_time: isClosed ? null : storeCloseTime,
          closed_week_rule: isClosed ? closedRule : null,
        };
      });
      await supabase.from("store_business_hours").insert(allDays);
      setClosedDayRules(
        modalHolidays.map((h) => ({
          dayOfWeek: h.dayOfWeek,
          day: weekdayNames[h.dayOfWeek] ?? "",
          rule: h.rule,
        }))
      );
      setShowHolidayModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setHolidaySaving(false);
    }
  };

  const handleDayClick = useCallback((y: number, m: number, d: number) => {
    const dateKey = formatDateKey(y, m, d);
    setEditDate(dateKey);
    setSaveError(null);
    const s = schedules[dateKey];
    const inferredOpen = s ? s.isOpen : !isClosedByRule(closedDayRules, y, m, d);
    setEditOpen(
      inferredOpen ? (s?.openTime || storeOpenTime) : storeOpenTime
    );
    setEditClose(
      inferredOpen ? (s?.closeTime || storeCloseTime) : storeCloseTime
    );
    setEditNote(s?.dailyNote ?? "");
    setShowEditPanel(true);
    setYear(y); setMonth(m); setSelectedDay(d);
  }, [schedules, storeOpenTime, storeCloseTime, closedDayRules]);

  const handleUpdateSchedule = useCallback(
    (key: string, schedule: DaySchedule) => {
      setSchedules((prev) => ({ ...prev, [key]: schedule }));
    }, []
  );

  const handleSaveTimeChange = async () => {
    if (!storeId || !editDate) return;
    setSaving(true);
    setSaveError(null);
    try {
      const note = editNote.trim() || null;
      const openT = (editOpen && editOpen.trim()) || storeOpenTime;
      const closeT = (editClose && editClose.trim()) || storeCloseTime;
      const existing = businessDays.find((bd) => bd.date === editDate);
      if (existing) {
        await updateBusinessDay(existing.id, {
          openTime: openT,
          closeTime: closeT,
          isOpen: true,
          dailyNote: note,
        });
      } else {
        await addBusinessDay({
          date: editDate,
          openTime: openT,
          closeTime: closeT,
          isOpen: true,
          storeId,
          dailyNote: note,
        });
      }
      setSchedules((prev) => ({
        ...prev,
        [editDate]: {
          isOpen: true,
          openTime: openT,
          closeTime: closeT,
          dailyNote: note ?? "",
        },
      }));
      setShowEditPanel(false);
    } catch (e: any) {
      console.error(e);
      setSaveError(e?.message || "保存に失敗しました。通信状況と権限をご確認ください。");
    }
    setSaving(false);
  };

  const handleSetClosed = async () => {
    if (!storeId || !editDate) return;
    setSaving(true);
    setSaveError(null);
    try {
      const note = editNote.trim() || null;
      const existing = businessDays.find((bd) => bd.date === editDate);
      if (existing) {
        await updateBusinessDay(existing.id, {
          isOpen: false,
          openTime: null,
          closeTime: null,
          dailyNote: note,
        });
      } else {
        await addBusinessDay({
          date: editDate,
          openTime: null,
          closeTime: null,
          isOpen: false,
          storeId,
          dailyNote: note,
        });
      }
      setSchedules((prev) => ({
        ...prev,
        [editDate]: {
          isOpen: false,
          openTime: storeOpenTime,
          closeTime: storeCloseTime,
          dailyNote: note ?? "",
        },
      }));
      setShowEditPanel(false);
    } catch (e: any) {
      console.error(e);
      setSaveError(e?.message || "保存に失敗しました。通信状況と権限をご確認ください。");
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
        <LineSpinner size={28} />
      </div>
    );
  }

  return (
    <div className="p-4 lg:p-6 relative flex flex-col lg:flex-row gap-6">
      <div className="flex-1">
        <div className="flex items-center justify-between gap-4 md:gap-8 mb-6">
          <div>
            <div className="flex items-center gap-4 md:gap-8 mb-1">
              <div>
                <span className="text-xs text-gray-500 block">OPEN</span>
                <span className="text-xl md:text-3xl font-normal block mt-1">{storeOpenTime}</span>
              </div>
              <div>
                <span className="text-xs text-gray-500 block">CLOSE</span>
                <span className="text-xl md:text-3xl font-normal block mt-1">{storeCloseTime}</span>
              </div>
            </div>
            <div className="mt-1">
              <span className="text-sm text-gray-500">定休日</span>
              <div className="flex items-center gap-2 md:gap-3 mt-0.5 flex-wrap">
                {closedDayRules.length > 0 ? (
                  closedDayRules.map((r, i) => (
                    <span key={i} className="text-xs md:text-sm font-medium">
                      {r.day} <span className="text-gray-500">{r.rule}</span>
                    </span>
                  ))
                ) : (
                  <span className="text-xs md:text-sm text-gray-600">未設定</span>
                )}
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                  onClick={openHolidayModal}
                  className="px-2 md:px-3 py-1 rounded-md bg-amber-400 text-white text-xs font-bold hover:bg-amber-500 transition-colors"
                >
                  変更
                </motion.button>
              </div>
            </div>
          </div>
          <div ref={exportMenuRef} className="relative shrink-0">
            <motion.button
              whileHover={{ scale: 1.02 }}
              whileTap={{ scale: 0.98 }}
              onClick={() => setShowExportMenu((v) => !v)}
              disabled={exporting}
              className="bg-amber-500 hover:bg-amber-600 text-white font-bold px-4 md:px-6 py-3 rounded-xl transition-colors text-sm disabled:opacity-50 flex items-center gap-2"
            >
              {exporting && <LineSpinner size={16} />}
              <span className="md:hidden">保存</span>
              <span className="hidden md:inline">カレンダーを保存</span>
            </motion.button>
            <AnimatePresence>
              {showExportMenu && !exporting && (
                <motion.div
                  initial={{ opacity: 0, y: -4 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -4 }}
                  className="absolute right-0 top-full mt-2 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-[240px] overflow-hidden"
                >
                  <button
                    type="button"
                    onClick={() => void handleExportImage("square")}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors"
                  >
                    Instagramフィード用 (1080×1080)
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExportImage("portrait")}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors border-t border-gray-100"
                  >
                    Instagramストーリー用 (1080×1920)
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExportImage("landscape")}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors border-t border-gray-100"
                  >
                    Xポスト用 (1920×1080)
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleExportImage("natural")}
                    className="w-full text-left px-4 py-2.5 text-sm hover:bg-amber-50 transition-colors border-t border-gray-100 text-gray-700"
                  >
                    原寸出力 (高解像度)
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

        <div ref={calendarRef} className="bg-white rounded-lg border border-gray-200 max-w-[480px] mx-auto">
          {/* ヘッダー: 左スペーサー | 中央月数字 | 右ロゴ+営業時間 — 下揃え */}
          <div className="flex items-end px-8 pt-8 pb-5 gap-4">
            {/* 左スペーサー (右列と同幅を確保して月数字を真ん中に) */}
            <div className="flex-1" />

            {/* 中央: 月数字 + April | 2026 */}
            <div className="text-center shrink-0">
              <div className="text-[72px] font-normal leading-none text-gray-800 tabular-nums relative top-1">
                {String(month + 1).padStart(2, "0")}
              </div>
              <div className="text-base font-medium text-gray-500 mt-1 whitespace-nowrap">
                {EN_MONTHS[month]} | {year}
              </div>
            </div>

            {/* 右: ロゴ + 営業時間 (下揃え = April | 2026 行と同じベースライン) */}
            <div className="flex-1 flex flex-col justify-end" style={{ alignItems: "flex-end" }}>
              {storeLogo ? (
                <div style={{ display: "flex", justifyContent: "flex-end", width: "100%" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img
                    src={storeLogo}
                    alt={storeName || ""}
                    style={{ maxHeight: 53, maxWidth: 123, objectFit: "contain" }}
                    crossOrigin="anonymous"
                  />
                </div>
              ) : storeName ? (
                <span className="text-sm font-bold text-gray-700" style={{ textAlign: "right", width: "100%" }}>{storeName}</span>
              ) : null}
              <div style={{ textAlign: "right", width: "100%" }} className="text-base text-gray-700 mt-1 tabular-nums whitespace-nowrap">
                {storeOpenTime} - {storeCloseTime}
              </div>
            </div>
          </div>
          <div className="px-4 pb-5">
        {viewMode === "month" && (
          <MonthView
            year={year}
            month={month}
            schedules={schedules}
            onDayClick={handleDayClick}
            defaultOpenTime={storeOpenTime}
            defaultCloseTime={storeCloseTime}
            closedDayRules={closedDayRules}
          />
        )}
        {viewMode === "week" && (
          <WeekView weekStart={weekStart} schedules={schedules} onDayClick={handleDayClick} defaultOpenTime={storeOpenTime} defaultCloseTime={storeCloseTime} closedDayRules={closedDayRules} />
        )}
        {viewMode === "day" && (
          <DayView year={year} month={month} day={selectedDay} schedules={schedules} onUpdateSchedule={handleUpdateSchedule} defaultOpenTime={storeOpenTime} defaultCloseTime={storeCloseTime} closedDayRules={closedDayRules} />
        )}
          </div>
        </div>
      </div>

      {/* 右側編集パネル */}
      <AnimatePresence>
        {showEditPanel && (
          <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 20 }}
            className="w-full lg:w-[280px] shrink-0"
          >
            <div className="bg-white border border-gray-200 rounded-xl p-5 shadow-lg relative sticky top-6">
              <button
                onClick={() => setShowEditPanel(false)}
                className="absolute top-3 right-3 text-gray-600 hover:text-gray-600"
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
                <div>
                  <label className="text-sm font-medium block mb-1">一言（カレンダーに表示）</label>
                  <textarea
                    value={editNote}
                    onChange={(e) => setEditNote(e.target.value)}
                    rows={2}
                    maxLength={80}
                    placeholder="例: ケーキの日、定休のためお休み など"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm bg-white resize-none"
                  />
                  <p className="text-[11px] text-gray-600 mt-0.5">最大80文字</p>
                </div>
              </div>

              {saveError && (
                <p className="text-xs text-red-600 bg-red-50 border border-red-100 rounded-lg px-2 py-1.5 mb-3">
                  {saveError}
                </p>
              )}

              <div className="space-y-2">
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => void handleSaveTimeChange()}
                  disabled={saving}
                  className="w-full bg-amber-500 hover:bg-amber-600 text-white font-bold py-2.5 rounded-lg transition-colors text-sm disabled:opacity-50"
                >
                  {viewMode === "month" ? "営業日に変更" : "上記の時間に変更"}
                </motion.button>
                <motion.button
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                  onClick={() => void handleSetClosed()}
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

      <AnimatePresence>
        {showHolidayModal && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.2 }}
            className="fixed inset-0 z-50 flex items-center justify-center bg-black/30"
            onClick={() => setShowHolidayModal(false)}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.95 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.2 }}
              onClick={(e) => e.stopPropagation()}
              className="bg-white rounded-xl shadow-xl w-full max-w-md mx-4 p-8 relative"
            >
              <button
                type="button"
                onClick={() => setShowHolidayModal(false)}
                className="absolute top-4 right-4 text-gray-600 hover:text-gray-600 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
              <h2 className="text-lg font-bold text-center mb-6">定休日の変更</h2>
              <div className="space-y-3 mb-6">
                {WEEKDAYS.map((wd) => {
                  const selected = modalHolidays.find((h) => h.dayOfWeek === wd.value);
                  return (
                    <div key={wd.value} className="flex items-center gap-3">
                      <motion.button
                        type="button"
                        whileHover={{ scale: 1.05 }}
                        whileTap={{ scale: 0.95 }}
                        onClick={() => toggleModalHoliday(wd.value)}
                        className={`w-10 h-10 rounded-full text-sm font-bold transition-colors ${
                          selected
                            ? "bg-amber-400 text-white"
                            : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                        }`}
                      >
                        {wd.label}
                      </motion.button>
                      {selected && (
                        <select
                          value={selected.rule}
                          onChange={(e) => updateModalHolidayRule(wd.value, e.target.value)}
                          className="border border-gray-300 rounded-md px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-amber-300"
                        >
                          <option value="毎週">毎週</option>
                          <option value="第1">第1</option>
                          <option value="第2">第2</option>
                          <option value="第3">第3</option>
                          <option value="第4">第4</option>
                          <option value="第1.3">第1・3</option>
                          <option value="第1.4">第1・4</option>
                          <option value="第2.4">第2・4</option>
                        </select>
                      )}
                    </div>
                  );
                })}
              </div>
              <div className="flex justify-center">
                <motion.button
                  type="button"
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                  onClick={saveHolidayRules}
                  disabled={holidaySaving}
                  className="px-6 py-2 rounded-md bg-amber-400 text-white font-bold text-sm hover:bg-amber-500 transition-colors disabled:opacity-50 flex items-center gap-2"
                >
                  {holidaySaving && <LineSpinner size={16} />}
                  以上の内容に変更
                </motion.button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

    </div>
  );
}
