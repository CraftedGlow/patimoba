"use client";

import { weekdayLabels, formatDateKey, isClosedByRule } from "./types";
import type { DaySchedule, ClosedDayRule } from "./types";

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
      <div className="grid grid-cols-[60px_repeat(7,1fr)] bg-gray-100 border-b border-gray-300">
        <div />
        {days.map((d, i) => {
          return (
            <div
              key={i}
              onClick={() => onDayClick(d.getFullYear(), d.getMonth(), d.getDate())}
              className="text-center py-2 cursor-pointer hover:bg-gray-200 transition-colors border-l border-gray-200"
            >
              <div className="text-xs text-gray-500">
                {weekdayLabels[d.getDay()]} {d.getDate()}/{String(d.getMonth() + 1).padStart(2, "0")}
              </div>
            </div>
          );
        })}
      </div>

      {/* 終日行 */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-200">
        <div className="text-xs text-gray-500 flex items-center justify-center py-2 border-r border-gray-200">
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
        <div key={hour} className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-gray-100">
          <div className="text-xs text-gray-500 flex items-center justify-center py-3 border-r border-gray-200">
            {hour}時
          </div>
          {days.map((d, i) => {
            const key = formatDateKey(d.getFullYear(), d.getMonth(), d.getDate());
            const schedule = schedules[key];
            const closedByRule = isClosedByRule(closedDayRules, d.getFullYear(), d.getMonth(), d.getDate());
            const isOpen = schedule ? schedule.isOpen : !closedByRule;
            const openH = parseInt((schedule?.openTime || defaultOpenTime).split(":")[0]);
            const closeH = parseInt((schedule?.closeTime || defaultCloseTime).split(":")[0]);
            const inRange = isOpen && hour >= openH && hour < closeH;

            return (
              <div
                key={i}
                onClick={() => onDayClick(d.getFullYear(), d.getMonth(), d.getDate())}
                className={`border-l border-gray-200 cursor-pointer transition-colors relative ${
                  inRange
                    ? "bg-[#5B8FA8]"
                    : "hover:bg-gray-50"
                }`}
              >
                {inRange && hour === openH && (
                  <div className="absolute top-1 left-1 text-[9px] text-white font-medium leading-tight">
                    {schedule?.openTime || defaultOpenTime} - {schedule?.closeTime || defaultCloseTime}
                    <br />営業日
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
