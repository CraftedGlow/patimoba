import type { Database } from "@/lib/database.types";

// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;
type UserRow = Database["public"]["Tables"]["users"]["Row"];

export interface FindOrCreateLineUserResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  error: string | null;
}

/**
 * LIFF の ID トークンを LINE の /verify で検証し、検証済みのクレームを返す。
 * liffId の `-` より前がチャンネルID（ID トークンの aud）。クライアントが任意のチャンネルの
 * トークンを持ち込めないよう、liffId は店舗に登録済みの LIFF ID（stores.liff_id）か
 * NEXT_PUBLIC_LIFF_ID のみ許可する。liffId 未指定時は LINE_LOGIN_CHANNEL_ID で検証する。
 */
export async function verifyLiffIdToken(
  supabaseAdmin: AdminClient,
  idToken: string,
  liffId: string | null
): Promise<
  | { ok: true; claims: { sub: string; name?: string; picture?: string } }
  | { ok: false; status: number; error: string }
> {
  let channelId: string | undefined;
  if (liffId) {
    if (liffId !== process.env.NEXT_PUBLIC_LIFF_ID) {
      const { data: store, error } = await supabaseAdmin
        .from("stores")
        .select("id")
        .eq("liff_id", liffId)
        .limit(1)
        .maybeSingle();
      if (error) return { ok: false, status: 500, error: "liff_lookup_failed" };
      if (!store) return { ok: false, status: 400, error: "invalid_liff_id" };
    }
    channelId = liffId.split("-")[0];
  } else {
    channelId = process.env.LINE_LOGIN_CHANNEL_ID;
  }
  if (!channelId) return { ok: false, status: 500, error: "server_misconfigured" };

  const verifyRes = await fetch("https://api.line.me/oauth2/v2.1/verify", {
    method: "POST",
    headers: { "Content-Type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ id_token: idToken, client_id: channelId }),
  });
  const verified = await verifyRes.json().catch(() => null);
  if (!verifyRes.ok || !verified?.sub) return { ok: false, status: 401, error: "invalid_token" };
  return { ok: true, claims: verified };
}

/**
 * 同一キーで users 行が重複している場合でも maybeSingle() のエラーで「該当なし」扱いに
 * ならないよう、複数行を取得して auth_user_id 付き・古い行を優先して1件選ぶ。
 */
export function pickPreferredUserRow<T extends { auth_user_id: string | null }>(
  rows: T[] | null | undefined
): T | null {
  if (!rows || rows.length === 0) return null;
  return rows.find((r) => r.auth_user_id) ?? rows[0];
}

/**
 * LINE ユーザー用の内部メールアドレスで auth.users を作成（既存ならその ID を取得）する。
 */
export async function getOrCreateLineAuthUser(
  supabaseAdmin: AdminClient,
  fakeEmail: string,
  lineUserId: string
): Promise<{ authUserId: string | null; error: string | null }> {
  const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
    email: fakeEmail,
    email_confirm: true,
    user_metadata: { line_user_id: lineUserId },
  });
  if (authData?.user) return { authUserId: authData.user.id, error: null };
  if (!authError) return { authUserId: null, error: "no auth user returned" };

  const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
    type: "magiclink",
    email: fakeEmail,
  });
  if (linkData?.user?.id) return { authUserId: linkData.user.id, error: null };
  return { authUserId: null, error: linkError?.message || authError.message };
}

/**
 * 指定の auth_user_id に既に紐づいている users 行を返す（無ければ null）。
 * 1つの auth ユーザーを複数の users 行で共有させないためのチェックに使う
 * （共有されると lib/api-auth.ts の maybeSingle() が null になり API が 401 になる）。
 */
export async function findUserRowByAuthUserId(
  supabaseAdmin: AdminClient,
  authUserId: string
): Promise<{ row: UserRow | null; error: string | null }> {
  const { data, error } = await supabaseAdmin
    .from("users")
    .select("*")
    .eq("auth_user_id", authUserId)
    .order("created_at", { ascending: true })
    .limit(2);
  if (error) return { row: null, error: error.message };
  return { row: data?.[0] ?? null, error: null };
}

/**
 * line_user_id (+ liff_id) からユーザーを特定し、存在しなければ Supabase auth + users レコードを
 * 自動作成する。app/api/line/liff-login/route.ts のログイン処理から使う。
 * 表示名・アイコンの最新化はログイン後にクライアント側（lib/liff-login.ts）が
 * liff.getProfile() の結果で直接更新するので、ここでは新規作成時の初期値としてのみ使う。
 *
 * liff_id の意味: 店舗ごとの LIFF アプリ単位で users 行を分ける（同じ LINE ユーザーでも
 * 店舗 LIFF ごとに別の顧客行になる）。liff_id が null の行は LIFF 導入前からの行。
 */
export async function findOrCreateLineUser(
  lineUserId: string,
  liffId: string | null,
  supabaseAdmin: AdminClient,
  fallback?: { lineName?: string; avatarUrl?: string | null }
): Promise<FindOrCreateLineUserResult> {
  const baseQuery = () =>
    supabaseAdmin
      .from("users")
      .select("*")
      .eq("line_user_id", lineUserId)
      .order("created_at", { ascending: true });

  const { data: rows, error: lookupError } = liffId
    ? await baseQuery().eq("liff_id", liffId)
    : await baseQuery();
  // 検索自体が失敗したときに「該当なし」とみなして行を増やさない
  if (lookupError) return { user: null, error: lookupError.message };
  let user: FindOrCreateLineUserResult["user"] = pickPreferredUserRow<UserRow>(rows);

  // 後方互換: liff_id 未設定の既存ユーザーを line_user_id のみで検索し、liff_id を自動設定
  if (!user && liffId) {
    const { data: legacyRows, error: legacyError } = await baseQuery().is("liff_id", null);
    if (legacyError) return { user: null, error: legacyError.message };
    const legacyUser = pickPreferredUserRow<UserRow>(legacyRows);

    if (legacyUser) {
      await supabaseAdmin.from("users").update({ liff_id: liffId }).eq("id", legacyUser.id);
      user = { ...legacyUser, liff_id: liffId };
    }
  }

  // auth ユーザーの内部メールは liff_id 単位で分ける（新規作成時・後付けリンク時で同じ規則）
  const fakeEmail = liffId
    ? `line_${lineUserId}_${liffId}@patimoba.internal`
    : `line_${lineUserId}@patimoba.internal`;

  if (!user) {
    const { authUserId, error: authErr } = await getOrCreateLineAuthUser(supabaseAdmin, fakeEmail, lineUserId);
    if (!authUserId) return { user: null, error: authErr };

    // 既にこの auth ユーザーに紐づく行がある（同時リクエストの競合など）なら、新しい行は作らずそれを使う
    const { row: linkedRow, error: linkedErr } = await findUserRowByAuthUserId(supabaseAdmin, authUserId);
    if (linkedErr) return { user: null, error: linkedErr };
    if (linkedRow) {
      if (linkedRow.line_user_id !== lineUserId) {
        return { user: null, error: "auth_user_already_linked" };
      }
      return { user: linkedRow, error: null };
    }

    const { data: newUser, error: insertError } = await supabaseAdmin
      .from("users")
      .insert({
        line_user_id: lineUserId,
        liff_id: liffId,
        line_name: fallback?.lineName || "",
        avatar_url: fallback?.avatarUrl ?? null,
        user_type: "customer",
        auth_user_id: authUserId,
      })
      .select()
      .single();

    if (insertError?.code === "23505") {
      // 同時リクエストが先に同じ auth ユーザーの行を作成した（users.auth_user_id の一意インデックス違反）。その行を使う
      const { row: raceRow } = await findUserRowByAuthUserId(supabaseAdmin, authUserId);
      if (raceRow && raceRow.line_user_id === lineUserId) return { user: raceRow, error: null };
    }
    if (insertError || !newUser) {
      return { user: null, error: insertError?.message || "user_create_failed" };
    }

    user = newUser;
  }

  if (!user.auth_user_id) {
    const { authUserId, error: authErr } = await getOrCreateLineAuthUser(supabaseAdmin, fakeEmail, lineUserId);
    if (!authUserId) return { user: null, error: authErr };

    // 別の行で使用中の auth ユーザーは紐づけない（1つの auth ユーザーを複数行で共有させない）
    const { row: linkedRow, error: linkedErr } = await findUserRowByAuthUserId(supabaseAdmin, authUserId);
    if (linkedErr) return { user: null, error: linkedErr };
    if (linkedRow && linkedRow.id !== user.id) {
      return { user: null, error: "auth_user_already_linked" };
    }

    // auth_user_id が未設定のままの行にだけ紐づける（同時リクエストで上書きしない）
    const { data: linked, error: updateError } = await supabaseAdmin
      .from("users")
      .update({ auth_user_id: authUserId })
      .eq("id", user.id)
      .is("auth_user_id", null)
      .select()
      .maybeSingle();
    if (updateError) return { user: null, error: updateError.message };
    if (!linked) {
      // 先行リクエストが既に紐づけ済み → 最新の行を読み直す
      const { data: latest } = await supabaseAdmin.from("users").select("*").eq("id", user.id).maybeSingle();
      if (!latest?.auth_user_id) return { user: null, error: "auth_link_failed" };
      user = latest;
    } else {
      user = linked;
    }
  }

  return { user, error: null };
}
