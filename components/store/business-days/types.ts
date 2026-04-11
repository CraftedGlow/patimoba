export type ViewMode = "month" | "week" | "day";

export interface DaySchedule {
  isOpen: boolean;
  openTime: string;
  closeTime: string;
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
