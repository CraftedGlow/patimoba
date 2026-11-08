-- public.users の権限・本人識別に関わる列をクライアントから変更できないようにする
--
-- 背景: RLS の users_insert_self_or_admin は auth_user_id = auth.uid() しか見ず、
-- users_update_self は自分の行の全列を更新できるため、誰でもアカウントを作って
-- 自分の行を user_type = 'admin' にでき、is_app_admin() を通過できてしまっていた。
--
-- 制限の対象: PostgREST 経由のクライアント（ロール anon / authenticated）のうち、アプリ管理者以外。
--   * Service Role Key を使うサーバー処理（app/api/...）は PostgREST 上でロール service_role になる
--   * SQL エディタ・マイグレーション（postgres / supabase_admin）
--   * SECURITY DEFINER 関数の中からの更新（current_user は関数の所有者になる）
--   はいずれも current_user が anon / authenticated ではないため制限しない。
--   そのため、この関数自体は SECURITY DEFINER にしない（current_user で呼び出し元ロールを判定するため）。
--
-- 制限する列:
--   user_type    : 挿入時は 'customer' のみ。更新で変更不可（店舗・管理者アカウントは管理者が作成する）
--   auth_user_id : 更新で変更不可（ログインアカウントの付け替えによる乗っ取り防止）
--   line_user_id, liff_id : 挿入時は NULL のみ・更新で変更不可（LINE ログインはサーバー側で紐づける）
-- ※ points / customer_id / name / phone / line_name / avatar_url 等はクライアント
--   （会計時のポイント利用、3DS後のカード顧客ID保存、プロフィール編集、LIFFのプロフィール同期）が
--   自分の行に書き込んでいるため、ここでは制限しない。

create or replace function public.enforce_users_protected_columns()
returns trigger
language plpgsql
set search_path = public
as $$
begin
  if current_user not in ('anon', 'authenticated') then
    return new;
  end if;

  if public.is_app_admin() then
    return new;
  end if;

  if tg_op = 'INSERT' then
    if new.user_type is distinct from 'customer' then
      raise exception 'user_type を customer 以外に設定する権限がありません'
        using errcode = '42501';
    end if;
    if new.line_user_id is not null or new.liff_id is not null then
      raise exception 'line_user_id / liff_id を設定する権限がありません'
        using errcode = '42501';
    end if;
  else
    if new.user_type is distinct from old.user_type then
      raise exception 'user_type を変更する権限がありません'
        using errcode = '42501';
    end if;
    if new.auth_user_id is distinct from old.auth_user_id
       or new.line_user_id is distinct from old.line_user_id
       or new.liff_id is distinct from old.liff_id then
      raise exception 'auth_user_id / line_user_id / liff_id を変更する権限がありません'
        using errcode = '42501';
    end if;
  end if;

  return new;
end;
$$;

drop trigger if exists users_enforce_protected_columns on public.users;
create trigger users_enforce_protected_columns
  before insert or update on public.users
  for each row
  execute function public.enforce_users_protected_columns();
