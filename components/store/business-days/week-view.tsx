"use client";

import { weekdayLabels, formatDateKey, isClosedByRule, formatTimeHm, formatTimeRange } from "./types";
import type { DaySchedule, ClosedDayRule } from "./types";
import { isJapaneseHoliday } from "@/lib/japanese-holidays";

const WEEK_GRID_COLS =
  "[grid-template-columns:3rem_minmax(0,0.88fr)_repeat(5,minmax(0,1fr))_minmax(0,0.88fr)]";

interface WeekViewProps {
  weekStart: Date;
  schedules: Record<string, DaySchedule>;
  onDayClick: (y: number, m: number, d: number) => void;
  defaultOpenTime?: string;
  defaultCloseTime?: string;
  closedDayRules?: ClosedDayRule[];
}

const hours = Array.from({ length: 10 }, (_, i) => i + 6);

export function WeekView({ weekStart, schedules, onDayClick, defaultOpenTime = "10:00", defaultCloseTime = "19:00", closedDayRules = [] }: WeekViewProps) {
  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(weekStart);
    d.setDate(d.getDate() + i);
    return d;
  });

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className={`grid bg-gray-100 border-b border-gray-300 ${WEEK_GRID_COLS}`}>
        <div />
        {days.map((d, i) => {
          const dow = d.getDay();
          const holiday = isJapaneseHoliday(d.getFullYear(), d.getMonth(), d.getDate());
          const isRed = dow === 0 || holiday;
          return (
            <div
              key={i}
              onClick={() => onDayClick(d.getFullYear(), d.getMonth(), d.getDate())}
              className="text-center py-1.5 px-0.5 cursor-pointer hover:bg-gray-200 transition-colors border-l border-gray-200 min-w-0"
            >
              <div
                className={`text-xs font-semibold leading-tight ${
                  isRed ? "text-red-500" : dow === 6 ? "text-sky-600" : "text-gray-600"
                }`}
              >
                {weekdayLabels[dow]}
              </div>
              <div className={`text-sm font-medium tabular-nums mt-0.5 ${isRed ? "text-red-500" : "text-gray-800"}`}>
                {d.getDate()}/{String(d.getMonth() + 1).padStart(2, "0")}
              </div>
            </div>
          );
        })}
      </div>

      {/* 終日行 */}
      <div className={`grid border-b border-gray-200 ${WEEK_GRID_COLS}`}>
        <div className="text-sm text-gray-600 flex items-center justify-center py-2 border-r border-gray-200 font-medium">
          終日
        </div>
        {days.map((d, i) => {
          const key = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
          const schedule = schedules[key];
          const closedByRule = isClosedByRule(closedDayRules, d.getFullYear(), d.getMonth(), d.getDate());
          const isOpen = schedule ? schedule.isOpen : !closedByRule;
          return (
            <div
              key={i}
              className={`border-l border-gray-200 py-2 ${!isOpen ? "bg-amber-300" : ""}`}
              onClick={() => onDayClick(d.getFullYear(), d.getMonth(), d.getDate())}
            />
          );
        })}
      </div>

      {/* 時間グリッド */}
      {hours.map((hour) => (
        <div key={hour} className={`grid border-b border-gray-100 ${WEEK_GRID_COLS}`}>
          <div className="text-sm text-gray-600 flex items-center justify-center py-3 border-r border-gray-200 font-medium tabular-nums">
            {hour}時
          </div>
          {days.map((d, i) => {
            const key = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
            const schedule = schedules[key];
            const closedByRule = isClosedByRule(closedDayRules, d.getFullYear(), d.getMonth(), d.getDate());
            const isOpen = schedule ? schedule.isOpen : !closedByRule;
            const openStr = formatTimeHm(schedule?.openTime || defaultOpenTime) || schedule?.openTime || defaultOpenTime;
            const closeStr = formatTimeHm(schedule?.closeTime || defaultCloseTime) || schedule?.closeTime || defaultCloseTime;
            const openH = parseInt(openStr.split(":")[0], 10);
            const closeH = parseInt(closeStr.split(":")[0], 10);
            const inRange = isOpen && hour >= openH && hour < closeH;

            return (
              <div
                key={i}
                onClick={() => onDayClick(d.getFullYear(), d.getMonth(), d.getDate())}
                className={`border-l border-gray-200 cursor-pointer transition-colors relative min-h-[44px] ${
                  inRange ? "bg-sky-500" : "hover:bg-gray-50"
                }`}
              >
                {inRange && hour === openH && (
                  <div className="absolute top-1 left-1 right-1 text-xs text-white font-semibold leading-snug">
                    <span className="tabular-nums">
                      {formatTimeRange(schedule?.openTime, schedule?.closeTime, defaultOpenTime, defaultCloseTime)}
                    </span>
                    <br />
                    <span className="font-bold">営業日</span>
                  </div>
                )}
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
