"use client";

import { motion } from "framer-motion";
import { weekdayLabels, formatDateKey, isClosedByRule } from "./types";
import type { DaySchedule, ClosedDayRule } from "./types";

interface MonthViewProps {
  year: number;
  month: number;
  schedules: Record<string, DaySchedule>;
  onDayClick: (y: number, m: number, d: number) => void;
  defaultOpenTime?: string;
  closedDayRules?: ClosedDayRule[];
}

export function MonthView({ year, month, schedules, onDayClick, defaultOpenTime = "10:00", closedDayRules = [] }: MonthViewProps) {
  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonthDays = new Date(year, month, 0).getDate();
  const nextMonthStart = 1;

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
      cells.push({ y: ny, m: nm, d: nextMonthStart + d, isCurrentMonth: false });
    }
  }

  return (
    <div className="border border-gray-300 rounded-lg overflow-hidden">
      <div className="grid grid-cols-7 bg-gray-100 border-b border-gray-300">
        {weekdayLabels.map((label, i) => (
          <div
            key={label}
            className={`text-center text-xs font-bold py-2 ${
              i === 0 ? "text-red-500" : i === 6 ? "text-blue-500" : "text-gray-600"
            }`}
          >
            {label}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {cells.map((cell, i) => {
          const key = formatDateKey(cell.y, cell.m, cell.d);
          const schedule = schedules[key];
          const closedByRule = isClosedByRule(closedDayRules, cell.y, cell.m, cell.d);
          const isOpen = schedule ? schedule.isOpen : !closedByRule;
          const dayOfWeek = new Date(cell.y, cell.m, cell.d).getDay();
          const isSunday = dayOfWeek === 0;

          return (
            <motion.div
              key={i}
              whileHover={{ backgroundColor: "#FFF9C4" }}
              onClick={() => onDayClick(cell.y, cell.m, cell.d)}
              className={`border-b border-r border-gray-200 min-h-[80px] p-1 cursor-pointer transition-colors ${
                cell.isCurrentMonth ? "" : "opacity-40"
              } ${isSunday && cell.isCurrentMonth ? "bg-amber-50/30" : ""}`}
            >
              <div className={`text-xs font-medium mb-1 ${
                isSunday ? "text-red-500" : dayOfWeek === 6 ? "text-blue-500" : "text-gray-700"
              }`}>
                {cell.d}日
              </div>
              {cell.isCurrentMonth && isOpen && (() => {
                const openT = schedule?.openTime || defaultOpenTime;
                const closeT = schedule?.closeTime || "";
                return (
                  <div className={`text-[10px] px-1 py-0.5 rounded leading-tight ${
                    schedule?.openTime ? "bg-red-500 text-white" : "bg-blue-400 text-white"
                  }`}>
                    <div className="font-bold">営業日</div>
                    <div>{openT}{closeT ? `〜${closeT}` : ""}</div>
                  </div>
                );
              })()}
              {cell.isCurrentMonth && !isOpen && (
                <div className="text-[10px] px-1 py-0.5 rounded bg-amber-400 text-white">
                  休業日
                </div>
              )}
            </motion.div>
          );
        })}
      </div>
    </div>
  );
}
