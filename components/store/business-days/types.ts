import { isJapaneseHoliday } from "@/lib/japanese-holidays";

export type ViewMode = "month" | "week" | "day";

export interface HoursProfile {
  open: string;
  close: string;
}

export interface StoreHoursProfiles {
  weekday: HoursProfile;
  weekend: HoursProfile;
  holiday: HoursProfile;
}

/** 祝日 > 休日(土日) > 平日 の優先順で、その日に適用される営業時間を返す */
export function getDefaultHoursForDate(
  profiles: StoreHoursProfiles,
  year: number,
  month: number,
  day: number
): HoursProfile {
  if (isJapaneseHoliday(year, month, day)) return profiles.holiday;
  const dow = new Date(year, month, day).getDay();
  if (dow === 0 || dow === 6) return profiles.weekend;
  return profiles.weekday;
}

export interface DaySchedule {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
  /** カレンダー日付セル用の一言（store_special_dates.reason 等） */
  dailyNote?: string;
}

/** DBの time / timestamptz 文字列を HH:mm で表示（例: 10:00:00 → 10:00） */
export function formatTimeHm(t: string | null | undefined): string {
  if (t == null || String(t).trim() === "") return "";
  const s = String(t).trim();
  const parts = s.split(":");
  if (parts.length >= 2) {
    const h = parts[0].padStart(2, "0").slice(-2);
    const m = parts[1].padStart(2, "0").slice(0, 2);
    return `${h}:${m}`;
  }
  return s;
}

/** カレンダー用 10:00~19:00 形式 */
export function formatTimeRange(
  open: string | null | undefined,
  close: string | null | undefined,
  defaultOpen = "10:00",
  defaultClose = "19:00"
): string {
  const o = formatTimeHm(open) || (open && String(open).trim()) || formatTimeHm(defaultOpen) || defaultOpen;
  const c = formatTimeHm(close) || (close && String(close).trim()) || formatTimeHm(defaultClose) || defaultClose;
  return `${o}~${c}`;
}

export interface ClosedDayRule {
  dayOfWeek: number;
  day: string;
  rule: string;
}

export function isClosedByRule(
  rules: ClosedDayRule[],
  year: number,
  month: number,
  day: number
): boolean {
  const date = new Date(year, month, day);
  const dow = date.getDay();
  const weekOfMonth = Math.ceil(day / 7);

  for (const rule of rules) {
    if (rule.dayOfWeek !== dow) continue;
    if (rule.rule === "毎週") return true;
    if (rule.rule === "第1" && weekOfMonth === 1) return true;
    if (rule.rule === "第2" && weekOfMonth === 2) return true;
    if (rule.rule === "第3" && weekOfMonth === 3) return true;
    if (rule.rule === "第4" && weekOfMonth === 4) return true;
    if (rule.rule === "第1.3" && (weekOfMonth === 1 || weekOfMonth === 3)) return true;
    if (rule.rule === "第1.4" && (weekOfMonth === 1 || weekOfMonth === 4)) return true;
    if (rule.rule === "第2.4" && (weekOfMonth === 2 || weekOfMonth === 4)) return true;
  }
  return false;
}

export const weekdayLabels = ["日", "月", "火", "水", "木", "金", "土"];

export function getWeekStartDate(date: Date): Date {
  const d = new Date(date);
  d.setDate(d.getDate() - d.getDay());
  d.setHours(0, 0, 0, 0);
  return d;
}

export function formatDateKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

export const timeOptions: string[] = [];
for (let h = 0; h < 24; h++) {
  for (let m = 0; m < 60; m += 30) {
    timeOptions.push(`${String(h).padStart(2, "0")}:${String(m).padStart(2, "0")}`);
  }
}
