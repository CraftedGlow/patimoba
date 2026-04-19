"use client";

import { formatDateKey, isClosedByRule } from "./types";
import type { DaySchedule, ClosedDayRule } from "./types";

const EN_WEEKDAYS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

const MONTH_GRID_COLS =
  "[grid-template-columns:minmax(0,0.88fr)_repeat(5,minmax(0,1fr))_minmax(0,0.88fr)]";

interface MonthViewProps {
  year: number;
  month: number;
  schedules: Record<string, DaySchedule>;
  onDayClick: (y: number, m: number, d: number) => void;
  defaultOpenTime?: string;
  defaultCloseTime?: string;
  closedDayRules?: ClosedDayRule[];
}

export function MonthView({
  year,
  month,
  schedules,
  onDayClick,
  defaultOpenTime = "10:00",
  defaultCloseTime = "19:00",
  closedDayRules = [],
}: MonthViewProps) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: Array<{ y: number; m: number; d: number; isCurrentMonth: boolean }> = [];

  for (let i = firstDay - 1; i >= 0; i--) {
    const pm = month === 0 ? 11 : month - 1;
    const py = month === 0 ? year - 1 : year;
    cells.push({ y: py, m: pm, d: prevMonthDays - i, isCurrentMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ y: year, m: month, d, isCurrentMonth: true });
  }
  const remaining = 7 - (cells.length % 7);
  if (remaining < 7) {
    for (let d = 0; d < remaining; d++) {
      const nm = month === 11 ? 0 : month + 1;
      const ny = month === 11 ? year + 1 : year;
      cells.push({ y: ny, m: nm, d: 1 + d, isCurrentMonth: false });
    }
  }

  return (
    <div className="border border-gray-300 rounded-sm overflow-hidden">
      {/* 曜日ヘッダー */}
      <div className={`grid ${MONTH_GRID_COLS} border-b border-gray-300`}>
        {EN_WEEKDAYS.map((label, i) => (
          <div
            key={label}
            className={`text-center text-sm font-semibold py-2 ${
              i === 0 ? "text-orange-500" : "text-gray-600"
            }`}
          >
            {label}
          </div>
        ))}
      </div>

      {/* 日付グリッド */}
      <div className={`grid ${MONTH_GRID_COLS}`}>
        {cells.map((cell, i) => {
          const key = formatDateKey(cell.y, cell.m, cell.d);
          const schedule = schedules[key];
          const closedByRule = isClosedByRule(closedDayRules, cell.y, cell.m, cell.d);
          const isOpen = schedule ? schedule.isOpen : !closedByRule;
          const dayOfWeek = new Date(cell.y, cell.m, cell.d).getDay();
          const isSunday = dayOfWeek === 0;

          return (
            <div
              key={i}
              onClick={() => cell.isCurrentMonth && onDayClick(cell.y, cell.m, cell.d)}
              className={`border-b border-r border-gray-200 min-h-[80px] p-2 flex flex-col ${
                cell.isCurrentMonth ? "cursor-pointer hover:bg-gray-50 transition-colors" : "pointer-events-none"
              }`}
            >
            <div className={cell.isCurrentMonth ? "" : "opacity-20"}>
              {cell.isCurrentMonth && !isOpen ? (
                /* 休業日: 丸枠日付 + 「休み」小さめ黒 */
                <>
                  <div className="self-start">
                    <span className="inline-flex items-center justify-center w-6 h-6 rounded-full border border-gray-600 text-xs font-medium text-gray-700 tabular-nums">
                      {cell.d}
                    </span>
                  </div>
                  <div className="flex-1 flex items-center justify-center">
                    <span className="text-sm font-medium text-gray-800">休み</span>
                  </div>
                </>
              ) : (
                /* 営業日: 日付 + カスタム営業時間があれば表示 */
                <>
                  <div className={`text-sm font-medium tabular-nums ${isSunday && cell.isCurrentMonth ? "text-orange-500" : "text-gray-700"}`}>
                    {cell.d}
                  </div>
                  {cell.isCurrentMonth && schedule && isOpen && (
                    schedule.openTime !== defaultOpenTime || schedule.closeTime !== defaultCloseTime
                  ) && (
                    <p className="text-[10px] text-gray-500 mt-0.5 tabular-nums leading-none">
                      {schedule.openTime.slice(0, 5)}〜{schedule.closeTime.slice(0, 5)}
                    </p>
                  )}
                  {cell.isCurrentMonth && schedule?.dailyNote?.trim() ? (
                    <p className="text-xs mt-1 text-gray-500 leading-snug line-clamp-2">
                      {schedule.dailyNote.trim()}
                    </p>
                  ) : null}
                </>
              )}
            </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
