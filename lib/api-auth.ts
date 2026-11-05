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

  const { data: appUser } = await supabaseAdmin
    .from("users")
    .select("id, user_type")
    .eq("auth_user_id", data.user.id)
    .maybeSingle();
  if (!appUser) return null;

  return { authUserId: data.user.id, id: appUser.id, userType: appUser.user_type };
}

/**
 * LINE未ログインのままEC決済に進んだゲスト用の軽量な users 行（auth_user_id を持たない）かどうか。
 * ログインセッションを持たない呼び出しを許容してよいかの判定に使う
 * （本物のログイン済みアカウントに対してなりすまし操作されるのは防ぐ）。
 */
export async function isGuestUserId(supabaseAdmin: AdminClient, userId: string): Promise<boolean> {
  const { data } = await supabaseAdmin
    .from("users")
    .select("auth_user_id")
    .eq("id", userId)
    .maybeSingle();
  return !!data && data.auth_user_id == null;
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
