export type OrderSummary = {
  id: string;
  order_no: string | null;
  order_type: string;
  pickup_date: string | null;
  pickup_time: string | null;
  total_amount: number;
  order_status: string;
  created_at: string;
  stores: { name: string } | null;
  order_items: { product_name_snapshot: string; quantity: number }[];
};

export const ORDER_TYPE_LABELS: Record<string, string> = {
  takeout: "店頭受け取り",
  ec: "配送",
};

const WEEKDAY = ["日", "月", "火", "水", "木", "金", "土"];

export function formatPickupDateTime(date: string | null, time: string | null): string {
  if (!date) return "受取日時未定";
  const d = new Date(date);
  const wday = WEEKDAY[d.getDay()];
  const base = `${d.getFullYear()}年${d.getMonth() + 1}月${d.getDate()}日（${wday}）`;
  return time ? `${base} ${time.slice(0, 5)}` : base;
}

export function itemsSummary(items: OrderSummary["order_items"]): string {
  if (items.length === 0) return "";
  const first = items[0].product_name_snapshot;
  return items.length > 1 ? `${first} 他${items.length - 1}点` : first;
}
