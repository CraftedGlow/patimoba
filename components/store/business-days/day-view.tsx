"use client";

import { weekdayLabels, formatDateKey, isClosedByRule } from "./types";
import type { DaySchedule, ClosedDayRule } from "./types";

interface DayViewProps {
  year: number;
  month: number;
  day: number;
  schedules: Record<string, DaySchedule>;
  onUpdateSchedule: (key: string, schedule: DaySchedule) => void;
  defaultOpenTime?: string;
  defaultCloseTime?: string;
  closedDayRules?: ClosedDayRule[];
}

const hours = Array.from({ length: 10 }, (_, i) => i + 6);

export function DayView({ year, month, day, schedules, onUpdateSchedule, defaultOpenTime = "10:00", defaultCloseTime = "19:00", closedDayRules = [] }: DayViewProps) {
  const date = new Date(year, month, day);
  const dayLabel = weekdayLabels[date.getDay()];
  const key = formatDateKey(year, month, day);
  const closedByRule = isClosedByRule(closedDayRules, year, month, day);
  const schedule = schedules[key] || { isOpen: !closedByRule, openTime: defaultOpenTime, closeTime: defaultCloseTime };

  const openH = parseInt(schedule.openTime.split(":")[0]);
  const closeH = parseInt(schedule.closeTime.split(":")[0]);

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="bg-gray-100 border-b border-gray-300 text-center py-2 text-sm font-bold">
        {dayLabel}曜日
      </div>

      {/* 終日行 */}
      <div className="flex border-b border-gray-200">
        <div className="w-[60px] text-xs text-gray-500 flex items-center justify-center py-2 border-r border-gray-200">
          終日
        </div>
        <div className={`flex-1 py-2 ${!schedule.isOpen ? "bg-amber-300" : ""}`} />
      </div>

      {hours.map((hour) => {
        const inRange = schedule.isOpen && hour >= openH && hour < closeH;
        return (
          <div key={hour} className="flex border-b border-gray-100">
            <div className="w-[60px] text-xs text-gray-500 flex items-center justify-center py-4 border-r border-gray-200">
              {hour}時
            </div>
            <div
              className={`flex-1 relative ${inRange ? "bg-[#5B8FA8]" : ""}`}
            >
              {inRange && hour === openH && (
                <div className="absolute top-1 left-2 text-[10px] text-white font-medium leading-tight">
                  {schedule.openTime} - {schedule.closeTime}
                  <br />営業日
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
