import { supabase } from "./supabase";

const SESSION_KEY = "patimoba_liff_id";

/** liff.state クエリパラメータから storeId を取り出す */
export function parseLiffStateStoreId(): string | null {
  try {
    const params = new URLSearchParams(window.location.search);
    const liffState = params.get("liff.state");
    if (!liffState) return null;
    const decoded = decodeURIComponent(liffState);
    const qIndex = decoded.indexOf("?");
    if (qIndex === -1) return null;
    const stateParams = new URLSearchParams(decoded.slice(qIndex + 1));
    return stateParams.get("store") ?? stateParams.get("storeId") ?? null;
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
        .select("liff_id")
        .eq("id", storeId)
        .single();
      if (data?.liff_id) {
        saveLiffId(data.liff_id);
        return data.liff_id;
      }
    } catch {}
  }

  return "";
}

export function saveLiffId(liffId: string): void {
  try { sessionStorage.setItem(SESSION_KEY, liffId); } catch {}
}
