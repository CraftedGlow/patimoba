/** 指定日が日本の祝日かどうかを返す */
export function isJapaneseHoliday(year: number, month: number, day: number): boolean {
  return getJapaneseHolidaysForYear(year).has(toKey(year, month, day));
}

function toKey(y: number, m: number, d: number): string {
  return `${y}-${String(m + 1).padStart(2, "0")}-${String(d).padStart(2, "0")}`;
}

function dateToKey(date: Date): string {
  return toKey(date.getFullYear(), date.getMonth(), date.getDate());
}

/** nth曜日の日付を返す（month: 0-indexed, dow: 0=Sun, 1=Mon...） */
function nthWeekday(year: number, month: number, n: number, dow: number): number {
  const first = new Date(year, month, 1).getDay();
  const firstOccurrence = 1 + ((dow - first + 7) % 7);
  return firstOccurrence + (n - 1) * 7;
}

function springEquinox(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

function autumnEquinox(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

const cache = new Map<number, Set<string>>();

function getJapaneseHolidaysForYear(year: number): Set<string> {
  if (cache.has(year)) return cache.get(year)!;

  const holidays = new Map<string, string>();

  const add = (m0: number, d: number, name: string) => {
    const key = toKey(year, m0, d);
    if (!holidays.has(key)) holidays.set(key, name);
  };

  // 固定祝日
  add(0, 1, "元日");
  add(1, 11, "建国記念の日");
  if (year >= 2020) add(1, 23, "天皇誕生日");
  if (year >= 2007) add(3, 29, "昭和の日");
  else add(3, 29, "みどりの日");
  add(4, 3, "憲法記念日");
  if (year >= 2007) add(4, 4, "みどりの日");
  add(4, 5, "こどもの日");
  if (year >= 2016) add(7, 11, "山の日");
  add(10, 3, "文化の日");
  add(10, 23, "勤労感謝の日");
  if (year >= 1989 && year <= 2018) add(11, 23, "天皇誕生日");

  // ハッピーマンデー
  if (year >= 2000) add(0, nthWeekday(year, 0, 2, 1), "成人の日");
  else add(0, 15, "成人の日");

  if (year >= 2003) add(6, nthWeekday(year, 6, 3, 1), "海の日");
  else add(6, 20, "海の日");

  if (year >= 2003) add(8, nthWeekday(year, 8, 3, 1), "敬老の日");
  else add(8, 15, "敬老の日");

  if (year >= 2020) add(9, nthWeekday(year, 9, 2, 1), "スポーツの日");
  else if (year >= 2000) add(9, nthWeekday(year, 9, 2, 1), "体育の日");
  else add(9, 10, "体育の日");

  // 春分・秋分
  add(2, springEquinox(year), "春分の日");
  add(8, autumnEquinox(year), "秋分の日");

  // 国民の祝日: 祝日に挟まれた平日
  const keys = Array.from(holidays.keys()).sort();
  const keySet = new Set(keys);
  for (const key of keys) {
    const base = new Date(key);
    const mid = new Date(base);
    mid.setDate(mid.getDate() + 1);
    const after = new Date(base);
    after.setDate(after.getDate() + 2);
    const midKey = dateToKey(mid);
    const afterKey = dateToKey(after);
    if (keySet.has(afterKey) && !keySet.has(midKey) && mid.getDay() !== 0) {
      holidays.set(midKey, "国民の祝日");
      keySet.add(midKey);
    }
  }

  // 振替休日: 日曜の祝日 → 翌月曜（月曜も祝日なら翌火曜…）
  const baseKeys = Array.from(holidays.keys()).sort();
  for (const key of baseKeys) {
    const date = new Date(key);
    if (date.getDay() === 0) {
      let next = new Date(date);
      next.setDate(next.getDate() + 1);
      while (holidays.has(dateToKey(next))) {
        next.setDate(next.getDate() + 1);
      }
      holidays.set(dateToKey(next), "振替休日");
    }
  }

  const result = new Set(holidays.keys());
  cache.set(year, result);
  return result;
}
