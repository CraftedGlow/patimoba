import { supabase } from "./supabase";
import type { Database } from "./database.types";

type StoreRow = Database["public"]["Tables"]["stores"]["Row"];
type StoreInsert = Database["public"]["Tables"]["stores"]["Insert"];
type StoreUpdate = Database["public"]["Tables"]["stores"]["Update"];
type OrderRow = Database["public"]["Tables"]["orders"]["Row"];

export type Store = StoreRow;
export type Order = OrderRow;

export async function fetchStores(search?: string) {
  let query = supabase.from("stores").select("*").order("id", { ascending: false });

  if (search && search.trim()) {
    const term = `%${search.trim()}%`;
    query = query.or(`name.ilike.${term},mail.ilike.${term},phone_num.ilike.${term},address_url.ilike.${term}`);
  }

  const { data, error } = await query;
  if (error) throw error;
  return data as Store[];
}

export async function fetchStoreById(id: number) {
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

export async function updateStore(id: number, updates: StoreUpdate) {
  const { data, error } = await supabase
    .from("stores")
    .update(updates)
    .eq("id", id)
    .select()
    .single();
  if (error) throw error;
  return data as Store;
}

export async function deleteStore(id: number) {
  const { error } = await supabase.from("stores").delete().eq("id", id);
  if (error) throw error;
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

export function mrrFromPlan(plan: number | null) {
  if (plan === 3) return 150000;
  if (plan === 2) return 98000;
  return 58000;
}

export function computeMRR(stores: Store[]): number {
  return stores.reduce((sum, s) => sum + mrrFromPlan(s.plan), 0);
}

export function computePlanBreakdown(stores: Store[]) {
  const plans = [
    { plan: 1, name: "ベーシック", color: "#F59E0B" },
    { plan: 2, name: "スタンダード", color: "#FDE68A" },
    { plan: 3, name: "プレミアム", color: "#D97706" },
  ];
  const totalMRR = computeMRR(stores);
  return plans.map((p) => {
    const filtered = stores.filter((s) => (s.plan ?? 1) === p.plan);
    const amount = filtered.reduce((sum, s) => sum + mrrFromPlan(s.plan), 0);
    const pct = totalMRR > 0 ? Math.round((amount / totalMRR) * 100) : 0;
    return {
      name: p.name,
      value: pct,
      amount: Math.round(amount / 10000),
      stores: filtered.length,
      color: p.color,
    };
  });
}

export async function fetchOrders(from?: string, to?: string) {
  let query = supabase
    .from("orders")
    .select("*")
    .order("id", { ascending: false });

  if (from) query = query.gte("created_date", from);
  if (to) query = query.lte("created_date", to);

  const { data, error } = await query;
  if (error) throw error;
  return data as Order[];
}

export async function fetchLineItems(from?: string, to?: string) {
  let query = supabase
    .from("line_items")
    .select("*")
    .order("id", { ascending: false });

  if (from) query = query.gte("created_date", from);
  if (to) query = query.lte("created_date", to);

  const { data, error } = await query;
  if (error) throw error;
  return data;
}

export async function fetchUsers() {
  const { data, error } = await supabase
    .from("users")
    .select("*")
    .order("id", { ascending: false });
  if (error) throw error;
  return data;
}

const LOGO_BUCKET = "store-logos";

export async function uploadStoreLogo(file: File, storeId?: number): Promise<string> {
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

export async function fetchBusinessDaySettings(storeId: number) {
  const { data, error } = await supabase
    .from("business_day_settings")
    .select("*")
    .eq("store_id", storeId)
    .order("id", { ascending: true });
  if (error) throw error;
  return data;
}

export async function saveClosedDays(storeId: number, closedDays: string[]) {
  const allDays = ["mon", "tue", "wed", "thu", "fri", "sat", "sun"];

  const { error: delErr } = await supabase
    .from("business_day_settings")
    .delete()
    .eq("store_id", storeId)
    .in("business_day", allDays);
  if (delErr) throw delErr;

  if (closedDays.length === 0) return;

  const rows = closedDays.map((day) => ({
    store_id: storeId,
    business_day: day,
    is_open: false,
    created_date: new Date().toISOString(),
  }));

  const { error: insErr } = await supabase
    .from("business_day_settings")
    .insert(rows);
  if (insErr) throw insErr;
}

export async function fetchClosedDays(storeId: number): Promise<string[]> {
  const { data, error } = await supabase
    .from("business_day_settings")
    .select("business_day")
    .eq("store_id", storeId)
    .eq("is_open", false);
  if (error) throw error;
  return (data ?? [])
    .map((r) => r.business_day)
    .filter((v): v is string => v !== null);
}
