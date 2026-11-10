import { supabase } from "@/lib/supabase";

/**
 * Supabase のログインセッションがあれば `Authorization: Bearer <access_token>` を付けて fetch する。
 * サーバー側（lib/api-auth.ts）で呼び出し元を検証する API ルートを呼ぶときに使う。
 * セッションが無い（ゲスト）場合はヘッダーなしで送る。
 */
export async function authFetch(input: RequestInfo | URL, init: RequestInit = {}): Promise<Response> {
  const { data: { session } } = await supabase.auth.getSession();
  const headers = new Headers(init.headers);
  if (session?.access_token && !headers.has("Authorization")) {
    headers.set("Authorization", `Bearer ${session.access_token}`);
  }
  return fetch(input, { ...init, headers });
}
