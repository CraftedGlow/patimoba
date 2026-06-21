-- Supabase Security Advisor で検出された脆弱性の修正

-- =========================================
-- 1. platform_settings: RLS有効化
--    利用規約・プライバシーポリシーが
--    RLS未設定のため誰でも書き換え可能だった
-- =========================================
alter table public.platform_settings enable row level security;

-- 利用規約・プライバシーポリシーは全員が閲覧可能
create policy "platform_settings_select_public"
  on public.platform_settings for select
  using (true);

-- 書き込みはadminのみ
create policy "platform_settings_admin_write"
  on public.platform_settings for all
  using (public.is_app_admin())
  with check (public.is_app_admin());

-- =========================================
-- 2. set_updated_at: search_path固定
--    search_pathが可変だとスキーマ検索順を
--    悪用したSQLインジェクションのリスクがある
-- =========================================
create or replace function public.set_updated_at()
returns trigger
language plpgsql
security invoker
set search_path = public
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- =========================================
-- 3. Storage: ファイル一覧取得ポリシーを削除
--    公開バケットはURLで直接アクセスできるため
--    SELECT ポリシーは不要。削除することで
--    全ファイル一覧の外部取得を防止する。
-- =========================================
drop policy if exists "product-images public read" on storage.objects;
drop policy if exists "store-logos public read" on storage.objects;
