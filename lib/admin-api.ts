import { supabase } from "./supabase";
import type { Database } from "./database.types";

type StoreRow = Database["public"]["Tables"]["stores"]["Row"];
type StoreInsert = Database["public"]["Tables"]["stores"]["Insert"];
type StoreUpdate = Database["public"]["Tables"]["stores"]["Update"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];
type OrderItemRow = Database["public"]["Tables"]["order_items"]["Row"];
type UserRow = Database["public"]["Tables"]["users"]["Row"];

export type Store = StoreRow;
export type Order = OrderRow;
export type Customer = UserRow;

export async function fetchStores(search?: string) {
  let query = supabase.from("stores").select("*").order("created_at", { ascending: false });

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`name.ilike.${term},email.ilike.${term},phone.ilike.${term},address.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Store[];
}

export async function fetchStoreById(id: string) {
  const { data, error } = await supabase
    .from("stores")
    .select("*")
    .eq("id", id)
    .single();
  if (error) throw error;
  return data as Store;
}

export async function createStore(store: StoreInsert) {
  const { data, error } = await supabase
    .from("stores")
    .insert(store)
    .select()
    .single();
  if (error) throw error;
  return data as Store;
}

export async function updateStore(id: string, updates: StoreUpdate) {
  const { data, error } = await supabase
    .from("stores")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Store;
}

export async function deleteStore(id: string) {
  const res = await fetch("/api/admin/delete-store", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ storeId: id }),
  });
  const result = await res.json();
  if (!res.ok) throw new Error(result.error || "店舗の削除に失敗しました");
}

export async function fetchStoreCount() {
  const { count, error } = await supabase
    .from("stores")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function fetchOrderCount() {
  const { count, error } = await supabase
    .from("orders")
    .select("*", { count: "exact", head: true });
  if (error) throw error;
  return count ?? 0;
}

export async function fetchOrders(from?: string, to?: string) {
  let query = supabase
    .from("orders")
    .select("*")
    .order("created_at", { ascending: false });

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) throw error;
  return data as Order[];
}

export async function fetchOrderItems(from?: string, to?: string) {
  let query = supabase
    .from("order_items")
    .select("*")
    .order("created_at", { ascending: false });

  if (from) query = query.gte("created_at", from);
  if (to) query = query.lte("created_at", to);

  const { data, error } = await query;
  if (error) throw error;
  return data as OrderItemRow[];
}

export async function fetchCustomers() {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .eq("user_type", "customer")
    .order("created_at", { ascending: false });
  if (error) throw error;
  return data as Customer[];
}

const LOGO_BUCKET = "store-logos";

export async function uploadStoreLogo(file: File, storeId?: string): Promise<string> {
  const ext = file.name.split(".").pop() ?? "png";
  const path = `${storeId ?? "new"}-${Date.now()}.${ext}`;

  const { error } = await supabase.storage
    .from(LOGO_BUCKET)
    .upload(path, file, { cacheControl: "3600", upsert: true });
  if (error) throw error;

  const { data } = supabase.storage.from(LOGO_BUCKET).getPublicUrl(path);
  return data.publicUrl;
}

export async function deleteStoreLogo(url: string): Promise<void> {
  const parts = url.split(`/${LOGO_BUCKET}/`);
  if (parts.length < 2) return;
  const filePath = parts[1];
  await supabase.storage.from(LOGO_BUCKET).remove([filePath]);
}

const DAY_NAMES = ["sun", "mon", "tue", "wed", "thu", "fri", "sat"] as const;
export type DayName = typeof DAY_NAMES[number];

function dayNameToIndex(name: string): number {
  const i = DAY_NAMES.indexOf(name as DayName);
  return i >= 0 ? i : -1;
}

function indexToDayName(i: number): DayName | null {
  return DAY_NAMES[i] ?? null;
}

export async function saveClosedDays(storeId: string, closedDays: string[]) {
  // store_business_hours テーブルで曜日別の定休日を管理
  // まず既存の曜日設定を削除
  const { error: delErr } = await supabase
    .from("store_business_hours")
    .delete()
    .eq("store_id", storeId);
  if (delErr) throw delErr;

  // 全曜日分のレコードを作成（定休日フラグ付き）
  const rows = Array.from({ length: 7 }, (_, i) => ({
    store_id: storeId,
    day_of_week: i,
    is_closed: closedDays.some((day) => dayNameToIndex(day) === i),
  }));

  const { error: insErr } = await supabase
    .from("store_business_hours")
    .insert(rows);
  if (insErr) throw insErr;
}

export async function fetchClosedDays(storeId: string): Promise<string[]> {
  const { data, error } = await supabase
    .from("store_business_hours")
    .select("day_of_week, is_closed")
    .eq("store_id", storeId)
    .eq("is_closed", true);
  if (error) throw error;
  const result: string[] = [];
  for (const r of data ?? []) {
    const name = indexToDayName(Number(r.day_of_week));
    if (name) result.push(name);
  }
  return result;
}

export async function fetchBusinessHours(storeId: string) {
  const { data, error } = await supabase
    .from("store_business_hours")
    .select("*")
    .eq("store_id", storeId)
    .order("day_of_week", { ascending: true });
  if (error) throw error;
  return data;
}

export async function fetchSpecialDates(storeId: string) {
  const { data, error } = await supabase
    .from("store_special_dates")
    .select("*")
    .eq("store_id", storeId)
    .order("target_date", { ascending: true });
  if (error) throw error;
  return data;
}
