"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { ArrowLeft } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CustomerHeader } from "@/components/customer/customer-header";
import { StepProgress } from "@/components/customer/step-progress";
import { useCustomerContext } from "@/lib/customer-context";

const steps = ["店舗選択", "商品選択", "受取日時", "注文確認"];

const timeSlots = [
  "11:00",
  "11:30",
  "12:00",
  "12:30",
  "13:00",
  "13:30",
  "14:00",
  "14:30",
  "15:00",
  "15:30",
  "16:00",
  "16:30",
  "17:00",
  "17:30",
  "18:00",
  "18:30",
];

function getNextDays(count: number) {
  const days = [];
  const today = new Date();
  for (let i = 2; i <= count + 1; i++) {
    const d = new Date(today);
    d.setDate(today.getDate() + i);
    days.push(d);
  }
  return days;
}

const weekdays = ["日", "月", "火", "水", "木", "金", "土"];

export default function TakeoutPickupPage() {
  const router = useRouter();
  const { selectedStoreName } = useCustomerContext();
  const days = getNextDays(14);
  const [selectedDate, setSelectedDate] = useState<Date | null>(null);
  const [selectedTime, setSelectedTime] = useState("12:00");

  const today = new Date();
  const currentMonth = selectedDate
    ? selectedDate.getMonth()
    : today.getMonth();
  const currentYear = selectedDate
    ? selectedDate.getFullYear()
    : today.getFullYear();

  const firstDayOfMonth = new Date(currentYear, currentMonth, 1);
  const startDay = firstDayOfMonth.getDay();
  const daysInMonth = new Date(currentYear, currentMonth + 1, 0).getDate();

  const calendarCells: (number | null)[] = [];
  for (let i = 0; i < startDay; i++) calendarCells.push(null);
  for (let d = 1; d <= daysInMonth; d++) calendarCells.push(d);

  const isDateSelectable = (day: number) => {
    const date = new Date(currentYear, currentMonth, day);
    const tomorrow = new Date(today);
    tomorrow.setDate(today.getDate() + 2);
    tomorrow.setHours(0, 0, 0, 0);
    return date >= tomorrow;
  };

  const isSelected = (day: number) => {
    if (!selectedDate) return false;
    return (
      selectedDate.getDate() === day &&
      selectedDate.getMonth() === currentMonth &&
      selectedDate.getFullYear() === currentYear
    );
  };

  return (
    <div className="min-h-screen bg-white">
      <CustomerHeader shopName={selectedStoreName || "パティモバ"} />

      <div className="px-4 pt-2">
        <Link
          href="/customer/takeout/products"
          className="inline-flex items-center text-gray-600 mb-1"
        >
          <ArrowLeft className="w-5 h-5" />
        </Link>
      </div>

      <StepProgress currentStep={3} steps={steps} />

      <div className="px-4 pb-8">
        <h2 className="text-lg font-bold mb-4">受け取り日時を選択</h2>

        <div className="border border-gray-200 rounded-xl p-4 mb-4">
          <div className="text-center text-sm font-bold mb-3">
            {currentYear}年{currentMonth + 1}月
          </div>

          <div className="grid grid-cols-7 gap-0 text-center">
            {weekdays.map((wd) => (
              <div
                key={wd}
                className="text-xs font-medium text-gray-400 py-1.5"
              >
                {wd}
              </div>
            ))}
            {calendarCells.map((day, i) => {
              if (day === null) {
                return <div key={`empty-${i}`} />;
              }
              const selectable = isDateSelectable(day);
              const selected = isSelected(day);
              return (
                <motion.button
                  key={day}
                  whileTap={selectable ? { scale: 0.9 } : undefined}
                  disabled={!selectable}
                  onClick={() => {
                    setSelectedDate(
                      new Date(currentYear, currentMonth, day)
                    );
                  }}
                  className={`aspect-square flex items-center justify-center text-sm rounded-lg m-0.5 transition-colors ${
                    selected
                      ? "border-2 border-amber-400 bg-amber-50 text-amber-700 font-bold"
                      : selectable
                      ? "text-gray-900 hover:bg-amber-50 border border-gray-200"
                      : "text-gray-300 border border-transparent"
                  }`}
                >
                  {day}
                </motion.button>
              );
            })}
          </div>

          <p className="text-xs text-gray-400 mt-3 text-center">
            一部商品は受取日の2日前までにご注文ください
          </p>
        </div>

        <div className="mb-6">
          <label className="block text-sm font-bold mb-2">時刻を選択</label>
          <select
            value={selectedTime}
            onChange={(e) => setSelectedTime(e.target.value)}
            className="w-full border border-gray-300 rounded-lg px-4 py-3 text-sm bg-white focus:outline-none focus:ring-2 focus:ring-amber-400 focus:border-transparent appearance-none"
            style={{
              backgroundImage:
                "url(\"data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='16' height='16' fill='%239ca3af' viewBox='0 0 24 24'%3E%3Cpath d='M7 10l5 5 5-5z'/%3E%3C/svg%3E\")",
              backgroundRepeat: "no-repeat",
              backgroundPosition: "right 12px center",
            }}
          >
            {timeSlots.map((t) => (
              <option key={t} value={t}>
                {t}
              </option>
            ))}
          </select>
        </div>

        <motion.button
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          onClick={() => router.push("/customer/takeout/confirm")}
          disabled={!selectedDate}
          className="w-full bg-amber-400 hover:bg-amber-500 disabled:bg-gray-200 disabled:text-gray-400 text-white font-bold py-3.5 rounded-full text-base transition-colors"
        >
          注文内容の確認へ
        </motion.button>
      </div>
    </div>
  );
}
