// eslint-disable-next-line @typescript-eslint/no-explicit-any
type SupabaseLike = any;

/**
 * 店舗自身、無ければ親店舗のLIFF IDを返す。
 * サーバー(service role)・クライアント(anon)どちらのSupabaseクライアントからも使える。
 */
export async function resolveEffectiveLiffId(storeId: string, supabase: SupabaseLike): Promise<string | null> {
  const { data: store } = await supabase
    .from("stores")
    .select("liff_id, parent_store_id")
    .eq("id", storeId)
    .maybeSingle();
  if (!store) return null;
  if (store.liff_id) return store.liff_id;
  if (store.parent_store_id) {
    const { data: parent } = await supabase
      .from("stores")
      .select("liff_id")
      .eq("id", store.parent_store_id)
      .maybeSingle();
    return parent?.liff_id ?? null;
  }
  return null;
}
