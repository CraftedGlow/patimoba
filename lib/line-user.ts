// eslint-disable-next-line @typescript-eslint/no-explicit-any
type AdminClient = any;

export interface FindOrCreateLineUserResult {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  user: any;
  error: string | null;
}

/**
 * line_user_id (+ liff_id) からユーザーを特定し、存在しなければ Supabase auth + users レコードを
 * 自動作成する。app/api/line/liff-login/route.ts のログイン処理と LINE Webhook の
 * follow イベント処理の両方から使う共通ロジック。
 */
export async function findOrCreateLineUser(
  lineUserId: string,
  liffId: string | null,
  lineName: string,
  avatarUrl: string | null,
  supabaseAdmin: AdminClient
): Promise<FindOrCreateLineUserResult> {
  let { data: user } = liffId
    ? await supabaseAdmin.from("users").select("*").eq("line_user_id", lineUserId).eq("liff_id", liffId).maybeSingle()
    : await supabaseAdmin.from("users").select("*").eq("line_user_id", lineUserId).maybeSingle();

  // 後方互換: liff_id 未設定の既存ユーザーを line_user_id のみで検索し、liff_id を自動設定
  if (!user && liffId) {
    const { data: legacyUser } = await supabaseAdmin
      .from("users")
      .select("*")
      .eq("line_user_id", lineUserId)
      .is("liff_id", null)
      .maybeSingle();

    if (legacyUser) {
      await supabaseAdmin.from("users").update({ liff_id: liffId }).eq("id", legacyUser.id);
      user = { ...legacyUser, liff_id: liffId };
    }
  }

  if (!user) {
    const fakeEmail = liffId
      ? `line_${lineUserId}_${liffId}@patimoba.internal`
      : `line_${lineUserId}@patimoba.internal`;

    let authUserId: string;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      email_confirm: true,
      user_metadata: { line_user_id: lineUserId },
    });

    if (authData?.user) {
      authUserId = authData.user.id;
    } else if (authError) {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: fakeEmail,
      });
      if (linkData?.user?.id) {
        authUserId = linkData.user.id;
      } else {
        return { user: null, error: linkError?.message || authError.message };
      }
    } else {
      return { user: null, error: "no auth user returned" };
    }

    const { data: newUser, error: insertError } = await supabaseAdmin
      .from("users")
      .insert({
        line_user_id: lineUserId,
        liff_id: liffId,
        line_name: lineName,
        avatar_url: avatarUrl,
        user_type: "customer",
        auth_user_id: authUserId,
      })
      .select()
      .single();

    if (insertError || !newUser) {
      return { user: null, error: insertError?.message || "user_create_failed" };
    }

    user = newUser;
  }

  const profileUpdates: Record<string, string> = {};
  if (lineName && user.line_name !== lineName) profileUpdates.line_name = lineName;
  if (avatarUrl && user.avatar_url !== avatarUrl) profileUpdates.avatar_url = avatarUrl;
  if (Object.keys(profileUpdates).length > 0) {
    await supabaseAdmin.from("users").update(profileUpdates).eq("id", user.id);
    user = { ...user, ...profileUpdates };
  }

  if (!user.auth_user_id) {
    const fakeEmail = `line_${lineUserId}@patimoba.internal`;
    let authUserId: string;
    const { data: authData, error: authError } = await supabaseAdmin.auth.admin.createUser({
      email: fakeEmail,
      email_confirm: true,
      user_metadata: { line_user_id: lineUserId },
    });

    if (authData?.user) {
      authUserId = authData.user.id;
    } else if (authError) {
      const { data: linkData, error: linkError } = await supabaseAdmin.auth.admin.generateLink({
        type: "magiclink",
        email: fakeEmail,
      });
      if (linkData?.user?.id) {
        authUserId = linkData.user.id;
      } else {
        return { user: null, error: linkError?.message || authError.message };
      }
    } else {
      return { user: null, error: "no auth user returned" };
    }

    await supabaseAdmin.from("users").update({ auth_user_id: authUserId }).eq("id", user.id);
    user = { ...user, auth_user_id: authUserId };
  }

  return { user, error: null };
}
