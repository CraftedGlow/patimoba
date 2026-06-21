"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ChevronLeft, ChevronRight } from "lucide-react";

const dayHeaders = ["日", "月", "火", "水", "木", "金", "土"];

interface DatePickerPopupProps {
  selectedDate: Date;
  onSelect: (date: Date) => void;
  onClear: () => void;
  onClose: () => void;
}

function getDaysInMonth(year: number, month: number) {
  return new Date(year, month + 1, 0).getDate();
}

function getFirstDayOfMonth(year: number, month: number) {
  return new Date(year, month, 1).getDay();
}

export function DatePickerPopup({
  selectedDate,
  onSelect,
  onClear,
  onClose,
}: DatePickerPopupProps) {
  const [viewYear, setViewYear] = useState(selectedDate.getFullYear());
  const [viewMonth, setViewMonth] = useState(selectedDate.getMonth());

  const daysInMonth = getDaysInMonth(viewYear, viewMonth);
  const firstDay = getFirstDayOfMonth(viewYear, viewMonth);

  const prevDaysInMonth = getDaysInMonth(
    viewMonth === 0 ? viewYear - 1 : viewYear,
    viewMonth === 0 ? 11 : viewMonth - 1
  );

  const prevMonth = () => {
    if (viewMonth === 0) {
      setViewYear(viewYear - 1);
      setViewMonth(11);
    } else {
      setViewMonth(viewMonth - 1);
    }
  };

  const nextMonth = () => {
    if (viewMonth === 11) {
      setViewYear(viewYear + 1);
      setViewMonth(0);
    } else {
      setViewMonth(viewMonth + 1);
    }
  };

  const cells: { day: number; inMonth: boolean }[] = [];
  for (let i = 0; i < firstDay; i++) {
    cells.push({ day: prevDaysInMonth - firstDay + 1 + i, inMonth: false });
  }
  for (let d = 1; d <= daysInMonth; d++) {
    cells.push({ day: d, inMonth: true });
  }
  const remaining = 42 - cells.length;
  for (let i = 1; i <= remaining; i++) {
    cells.push({ day: i, inMonth: false });
  }

  const isSelected = (day: number, inMonth: boolean) => {
    return (
      inMonth &&
      selectedDate.getFullYear() === viewYear &&
      selectedDate.getMonth() === viewMonth &&
      selectedDate.getDate() === day
    );
  };

  const isToday = (day: number, inMonth: boolean) => {
    const now = new Date();
    return (
      inMonth &&
      now.getFullYear() === viewYear &&
      now.getMonth() === viewMonth &&
      now.getDate() === day
    );
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: -4 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -4 }}
      transition={{ duration: 0.15 }}
      className="absolute right-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-xl p-4 z-50 w-[300px]"
    >
      <div className="flex items-center justify-between mb-3">
        <button
          onClick={prevMonth}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>
        <span className="text-sm font-bold">
          {viewMonth + 1}月 {viewYear}
        </span>
        <button
          onClick={nextMonth}
          className="p-1 hover:bg-gray-100 rounded transition-colors"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      <div className="grid grid-cols-7 text-center text-xs text-gray-600 mb-1">
        {dayHeaders.map((d) => (
          <div key={d} className="py-1">
            {d}
          </div>
        ))}
      </div>

      <div className="grid grid-cols-7 text-center text-sm">
        {cells.map((cell, i) => (
          <button
            key={i}
            onClick={() => {
              if (cell.inMonth) {
                onSelect(new Date(viewYear, viewMonth, cell.day));
              }
            }}
            className={`py-1.5 rounded-lg transition-colors ${
              !cell.inMonth
                ? "text-gray-300"
                : isSelected(cell.day, cell.inMonth)
                ? "bg-blue-500 text-white font-bold"
                : isToday(cell.day, cell.inMonth)
                ? "bg-blue-100 text-blue-700 font-bold"
                : "text-gray-700 hover:bg-gray-100"
            }`}
          >
            {cell.day}
          </button>
        ))}
      </div>

      <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-100">
        <button
          onClick={() => {
            const now = new Date();
            setViewYear(now.getFullYear());
            setViewMonth(now.getMonth());
            onSelect(now);
          }}
          className="text-xs text-blue-600 hover:text-blue-800 flex items-center gap-1"
        >
          <ChevronLeft className="w-3 h-3" /> 今日
        </button>
        <button
          onClick={onClear}
          className="text-xs text-red-500 hover:text-red-700"
        >
          - 消去
        </button>
        <button
          onClick={onClose}
          className="text-xs text-gray-600 hover:text-gray-800"
        >
          x Close
        </button>
      </div>
    </motion.div>
  );
}
