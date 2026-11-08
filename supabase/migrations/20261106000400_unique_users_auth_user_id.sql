-- 1つのログインアカウント（auth.users）に public.users の行が複数紐づかないようにする
--
-- 背景: LIFF ログインが同時に2回走ると（LINE がページを再読み込みする等）、同じ auth_user_id を持つ
-- users 行が2つ作られることがあった。API 認証（lib/api-auth.ts）は auth_user_id から本人の行を引くため、
-- 重複があると本人の行を特定できない。
--
-- 既に重複がある場合はこのマイグレーションは失敗する。先に以下で確認し、不要な行を整理すること:
--   select auth_user_id, array_agg(id order by created_at) as user_ids, count(*)
--   from public.users
--   where auth_user_id is not null
--   group by auth_user_id
--   having count(*) > 1;

do $$
begin
  if exists (
    select 1 from public.users
    where auth_user_id is not null
    group by auth_user_id
    having count(*) > 1
  ) then
    raise exception 'users.auth_user_id に重複があります。マイグレーション冒頭のクエリで確認・整理してから再実行してください';
  end if;
end;
$$;

create unique index if not exists users_auth_user_id_unique
  on public.users (auth_user_id)
  where auth_user_id is not null;
