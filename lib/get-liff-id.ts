import { supabase } from "./supabase";

const SESSION_KEY = "patimoba_liff_id";
const SESSION_STORE_ID_KEY = "patimoba_liff_store_id";

/** liff.state クエリパラメータから storeId を取り出す */
export function parseLiffStateStoreId(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const liffState = params.get("liff.state");
    if (!liffState) return null;
    const decoded = decodeURIComponent(liffState);

    // クエリパラメータ (?store=xxx or ?storeId=xxx) を優先
    const qIndex = decoded.indexOf("?");
    if (qIndex !== -1) {
      const stateParams = new URLSearchParams(decoded.slice(qIndex + 1));
      const id = stateParams.get("store") ?? stateParams.get("storeId");
      if (id) return id;
    }

    // パス内のUUIDを抽出 (例: /customer/takeout/store/[uuid] or /customer/takeout/[uuid])
    const uuidMatch = decoded.match(/([0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12})/i);
    return uuidMatch?.[1] ?? null;
  } catch {
    return null;
  }
}

/**
 * LIFF IDを取得する優先順位:
 * 1. sessionStorage (liff-loading で保存済み)
 * 2. storeId が分かればDBから取得
 * 3. 環境変数にフォールバック
 */
export async function getLiffId(storeId?: string | null): Promise<string> {
  try {
    const cached = sessionStorage.getItem(SESSION_KEY);
    if (cached) return cached;
  } catch {}

  if (storeId) {
    try {
      const { data } = await supabase
        .from("stores")
        .select("liff_id, is_master")
        .eq("id", storeId)
        .single();
      if (data?.liff_id) {
        saveLiffId(data.liff_id);
        saveLiffStoreId(storeId, data.is_master ?? false);
        return data.liff_id;
      }
    } catch {}
  }

  return "";
}

export function saveLiffId(liffId: string): void {
  try { sessionStorage.setItem(SESSION_KEY, liffId); } catch {}
}

export function saveLiffStoreId(storeId: string, isMaster: boolean): void {
  try {
    sessionStorage.setItem(SESSION_STORE_ID_KEY, JSON.stringify({ storeId, isMaster }));
  } catch {}
}

export function getLiffStoreInfo(): { storeId: string; isMaster: boolean } | null {
  try {
    const raw = sessionStorage.getItem(SESSION_STORE_ID_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch {
    return null;
  }
}
