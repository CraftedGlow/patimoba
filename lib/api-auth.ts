// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

export interface AuthenticatedAppUser {
  authUserId: string;
  id: string;
  userType: string;
}

/**
 * Authorization: Bearer <access_token> ヘッダーからSupabaseセッションを検証し、
 * 対応する public.users の行を返す。Service Role Keyを使うAPIルートで、
 * 呼び出し元が誰であるかを確認するために使う。
 */
export async function getAuthenticatedAppUser(
  req: Request,
  supabaseAdmin: AdminClient
): Promise<AuthenticatedAppUser | null> {
  const authHeader = req.headers.get("authorization") ?? req.headers.get("Authorization");
  const token = authHeader?.replace(/^Bearer\s+/i, "").trim();
  if (!token) return null;

  const { data, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !data?.user) return null;

  // 過去の不具合で同じ auth_user_id の行が複数ある場合でも 401 にならないよう、最も古い行を本人とみなす
  // （新規の重複は users.auth_user_id の一意インデックスで防ぐ）
  const { data: rows } = await supabaseAdmin
    .from("users")
    .select("id, user_type")
    .eq("auth_user_id", data.user.id)
    .order("created_at", { ascending: true })
    .limit(1);
  const appUser = rows?.[0];
  if (!appUser) return null;

  return { authUserId: data.user.id, id: appUser.id, userType: appUser.user_type };
}

/**
 * LINE未ログインのままEC決済に進んだゲスト用の軽量な users 行（auth_user_id も line_user_id も持たない顧客行）かどうか。
 * LINE 連携済み（未リンクのものを含む）の行やスタッフ行はゲストとみなさない。
 * ログインセッションを持たない呼び出しを許容してよいかの判定に使う
 * （本物のログイン済みアカウントに対してなりすまし操作されるのは防ぐ）。
 */
export async function isGuestUserId(supabaseAdmin: AdminClient, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("auth_user_id, line_user_id, user_type")
    .eq("id", userId)
    .maybeSingle();
  return !!data && data.auth_user_id == null && data.line_user_id == null && data.user_type === "customer";
}

/** その店舗のアクティブなスタッフかどうか（RLSの is_store_member() と同じ判定） */
export async function isStoreStaff(
  supabaseAdmin: AdminClient,
  appUserId: string,
  storeId: string
): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("store_users")
    .select("id")
    .eq("store_id", storeId)
    .eq("user_id", appUserId)
    .eq("is_active", true)
    .maybeSingle();
  return !!data;
}

export type AccessResult =
  | { ok: true; appUser: AuthenticatedAppUser | null }
  | { ok: false; status: 401 | 403; error: string };

/**
 * userId に対する操作を許可してよいか。
 * - ログイン済みなら本人（またはアプリ管理者）のみ
 * - 未ログインなら、対象が auth_user_id を持たないゲスト行のときのみ
 */
export async function authorizeUserAccess(
  req: Request,
  supabaseAdmin: AdminClient,
  userId: string
): Promise<AccessResult> {
  const appUser = await getAuthenticatedAppUser(req, supabaseAdmin);
  if (appUser && (appUser.id === userId || appUser.userType === "admin")) return { ok: true, appUser };
  // ゲスト行は未ログインでも操作できるため、別アカウントのセッションが残ったまま（ログアウトせずに）
  // ゲスト購入へ進んだ場合もゲスト行への操作は許可する。未ログイン時より権限を広げることはない
  if (await isGuestUserId(supabaseAdmin, userId)) return { ok: true, appUser: null };
  return appUser
    ? { ok: false, status: 403, error: "Forbidden" }
    : { ok: false, status: 401, error: "Unauthorized" };
}

/**
 * その店舗のスタッフ、その店舗の親（マスター）店舗のスタッフ、またはアプリ管理者として認証されているか。
 * RLS の is_store_member_or_master() と同じ範囲（マスターは子店舗の注文等を扱える）。
 */
export async function authorizeStoreStaff(
  req: Request,
  supabaseAdmin: AdminClient,
  storeId: string
): Promise<AccessResult> {
  const appUser = await getAuthenticatedAppUser(req, supabaseAdmin);
  if (!appUser) return { ok: false, status: 401, error: "Unauthorized" };
  if (appUser.userType === "admin") return { ok: true, appUser };
  if (await isStoreStaff(supabaseAdmin, appUser.id, storeId)) return { ok: true, appUser };

  const { data: store } = await supabaseAdmin
    .from("stores")
    .select("parent_store_id")
    .eq("id", storeId)
    .maybeSingle();
  if (store?.parent_store_id && (await isStoreStaff(supabaseAdmin, appUser.id, store.parent_store_id))) {
    return { ok: true, appUser };
  }
  return { ok: false, status: 403, error: "Forbidden" };
}
