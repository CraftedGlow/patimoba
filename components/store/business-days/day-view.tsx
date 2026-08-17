"use client";

import { weekdayLabels, formatDateKey, isClosedByRule, formatTimeHm, formatTimeRange, getDefaultHoursForDate } from "./types";
import type { DaySchedule, ClosedDayRule, StoreHoursProfiles } from "./types";

const DEFAULT_HOURS_PROFILES: StoreHoursProfiles = {
  weekday: { open: "10:00", close: "19:00" },
  weekend: { open: "10:00", close: "19:00" },
  holiday: { open: "10:00", close: "19:00" },
};

interface DayViewProps {
  year: number;
  month: number;
  day: number;
  schedules: Record<string, DaySchedule>;
  onUpdateSchedule: (key: string, schedule: DaySchedule) => void;
  hoursProfiles?: StoreHoursProfiles;
  closedDayRules?: ClosedDayRule[];
}

const hours = Array.from({ length: 10 }, (_, i) => i + 6);

export function DayView({ year, month, day, schedules, onUpdateSchedule, hoursProfiles = DEFAULT_HOURS_PROFILES, closedDayRules = [] }: DayViewProps) {
  const date = new Date(year, month, day);
  const dayLabel = weekdayLabels[date.getDay()];
  const key = formatDateKey(year, month, day);
  const closedByRule = isClosedByRule(closedDayRules, year, month, day);
  const cellDefault = getDefaultHoursForDate(hoursProfiles, year, month, day);
  const schedule = schedules[key] || {
    isOpen: !closedByRule,
    openTime: cellDefault.open,
    closeTime: cellDefault.close,
    dailyNote: "",
  };

  const openDisp = formatTimeHm(schedule.openTime) || schedule.openTime;
  const closeDisp = formatTimeHm(schedule.closeTime) || schedule.closeTime;
  const openH = parseInt(openDisp.split(":")[0], 10);
  const closeH = parseInt(closeDisp.split(":")[0], 10);

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="bg-gray-100 border-b border-gray-300 text-center py-2.5 px-2">
        <div className="text-base font-bold text-gray-800">{dayLabel}曜日</div>
        {schedule.dailyNote?.trim() ? (
          <p className="text-sm text-gray-600 mt-1 font-normal line-clamp-2">{schedule.dailyNote.trim()}</p>
        ) : null}
      </div>

      {/* 終日行 */}
      <div className="flex border-b border-gray-200">
        <div className="w-12 shrink-0 text-sm text-gray-600 flex items-center justify-center py-2 border-r border-gray-200 font-medium">
          終日
        </div>
        <div className={`flex-1 py-2 ${!schedule.isOpen ? "bg-amber-300" : ""}`} />
      </div>

      {hours.map((hour) => {
        const inRange = schedule.isOpen && hour >= openH && hour < closeH;
        return (
          <div key={hour} className="flex border-b border-gray-100 min-h-[48px]">
            <div className="w-12 shrink-0 text-sm text-gray-600 flex items-center justify-center py-3 border-r border-gray-200 font-medium tabular-nums">
              {hour}時
            </div>
            <div className={`flex-1 relative min-h-[48px] ${inRange ? "bg-sky-500" : ""}`}>
              {inRange && hour === openH && (
                <div className="absolute top-1.5 left-2 right-2 text-sm text-white font-semibold leading-snug">
                  <span className="tabular-nums">
                    {formatTimeRange(schedule.openTime, schedule.closeTime, cellDefault.open, cellDefault.close)}
                  </span>
                  <br />
                  <span className="font-bold">営業日</span>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}
